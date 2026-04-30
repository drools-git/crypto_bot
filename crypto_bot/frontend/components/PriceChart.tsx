"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, LineSeries, HistogramSeries, CrosshairMode } from 'lightweight-charts';

interface PriceChartProps {
  symbol: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({ symbol }) => {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const adxRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !macdRef.current || !adxRef.current) return;

    const commonOptions = {
      layout: { background: { type: ColorType.Solid, color: '#000000' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.03)' }, horzLines: { color: 'rgba(255, 255, 255, 0.03)' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' }
    };

    // 1. Main Chart
    const mainChart = createChart(mainRef.current, { ...commonOptions, height: mainRef.current.clientHeight });
    const candleSeries = mainChart.addSeries(CandlestickSeries, { upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444' });
    const volumeSeries = mainChart.addSeries(HistogramSeries, { color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    
    // Overlays
    const ema20 = mainChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, crosshairMarkerVisible: false });
    const ema50 = mainChart.addSeries(LineSeries, { color: '#eab308', lineWidth: 1, crosshairMarkerVisible: false });
    const ema200 = mainChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 2, crosshairMarkerVisible: false });
    const vwap = mainChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false });
    const bbHigh = mainChart.addSeries(LineSeries, { color: '#6b7280', lineWidth: 1, lineStyle: 3, crosshairMarkerVisible: false });
    const bbLow = mainChart.addSeries(LineSeries, { color: '#6b7280', lineWidth: 1, lineStyle: 3, crosshairMarkerVisible: false });

    // 2. RSI Chart
    const rsiChart = createChart(rsiRef.current, { ...commonOptions, height: rsiRef.current.clientHeight });
    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1 });
    // RSI thresholds (70/30) can be represented by constant lines or just visual bounds
    rsiChart.priceScale('right').applyOptions({ autoScale: false, scaleMargins: { top: 0.1, bottom: 0.1 }, minValue: 0, maxValue: 100 });

    // 3. MACD Chart
    const macdChart = createChart(macdRef.current, { ...commonOptions, height: macdRef.current.clientHeight });
    const macdLine = macdChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1 });
    const macdSignal = macdChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1 });
    const macdHist = macdChart.addSeries(HistogramSeries, { color: '#64748b' });

    // 4. ADX Chart
    const adxChart = createChart(adxRef.current, { ...commonOptions, height: adxRef.current.clientHeight });
    const adxLine = adxChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2 });
    const adxPos = adxChart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, lineStyle: 2 });
    const adxNeg = adxChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, lineStyle: 2 });

    // Sync timelines
    const syncCharts = (source: IChartApi, targets: IChartApi[]) => {
      source.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) {
          targets.forEach(t => {
            try {
              t.timeScale().setVisibleRange(range);
            } catch (e) {
              // Target chart might not have data yet, ignore
            }
          });
        }
      });
    };
    syncCharts(mainChart, [rsiChart, macdChart, adxChart]);
    syncCharts(rsiChart, [mainChart, macdChart, adxChart]);
    syncCharts(macdChart, [mainChart, rsiChart, adxChart]);
    syncCharts(adxChart, [mainChart, rsiChart, macdChart]);

    let ws: WebSocket;

    const fetchData = async () => {
      try {
        const host = window.location.hostname || 'localhost';
        const response = await fetch(`http://${host}:8000/api/v1/market/indicators?symbol=${symbol}&timeframe=1h&limit=500`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Parse data
          const candles = data.map((d: any) => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
          const volumes = data.map((d: any) => ({ time: d.time, value: d.volume, color: d.close >= d.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)' }));
          
          candleSeries.setData(candles);
          volumeSeries.setData(volumes);
          
          ema20.setData(data.filter(d => d.ema_20).map(d => ({ time: d.time, value: d.ema_20 })));
          ema50.setData(data.filter(d => d.ema_50).map(d => ({ time: d.time, value: d.ema_50 })));
          ema200.setData(data.filter(d => d.ema_200).map(d => ({ time: d.time, value: d.ema_200 })));
          vwap.setData(data.filter(d => d.vwap).map(d => ({ time: d.time, value: d.vwap })));
          bbHigh.setData(data.filter(d => d.bb_high).map(d => ({ time: d.time, value: d.bb_high })));
          bbLow.setData(data.filter(d => d.bb_low).map(d => ({ time: d.time, value: d.bb_low })));

          rsiSeries.setData(data.filter(d => d.rsi).map(d => ({ time: d.time, value: d.rsi })));

          macdLine.setData(data.filter(d => d.macd).map(d => ({ time: d.time, value: d.macd })));
          macdSignal.setData(data.filter(d => d.macd_signal).map(d => ({ time: d.time, value: d.macd_signal })));
          macdHist.setData(data.filter(d => d.macd_hist).map(d => ({ time: d.time, value: d.macd_hist, color: d.macd_hist >= 0 ? '#10b981' : '#ef4444' })));

          adxLine.setData(data.filter(d => d.adx).map(d => ({ time: d.time, value: d.adx })));
          adxPos.setData(data.filter(d => d.adx_pos).map(d => ({ time: d.time, value: d.adx_pos })));
          adxNeg.setData(data.filter(d => d.adx_neg).map(d => ({ time: d.time, value: d.adx_neg })));

          setLoading(false);
          
          // Connect WS for live price tick updates (candles only for performance)
          const stream = symbol.toLowerCase().replace('/', '');
          ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}@kline_1h`);
          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.k) {
              const kline = message.k;
              const tickTime = Math.floor(kline.t / 1000) as any;
              candleSeries.update({
                time: tickTime,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
              });
              // Volume update
              volumeSeries.update({
                time: tickTime,
                value: parseFloat(kline.v),
                color: parseFloat(kline.c) >= parseFloat(kline.o) ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'
              } as any);
            }
          };
        }
      } catch (error) {
        console.error('Error fetching indicators:', error);
      }
    };

    fetchData();

    const handleResize = () => {
      if (mainRef.current) mainChart.applyOptions({ width: mainRef.current.clientWidth, height: mainRef.current.clientHeight });
      if (rsiRef.current) rsiChart.applyOptions({ width: rsiRef.current.clientWidth, height: rsiRef.current.clientHeight });
      if (macdRef.current) macdChart.applyOptions({ width: macdRef.current.clientWidth, height: macdRef.current.clientHeight });
      if (adxRef.current) adxChart.applyOptions({ width: adxRef.current.clientWidth, height: adxRef.current.clientHeight });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws) ws.close();
      mainChart.remove();
      rsiChart.remove();
      macdChart.remove();
      adxChart.remove();
    };
  }, [symbol]);

  return (
    <div className="relative w-full h-full flex flex-col">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <p className="text-blue-500 text-sm animate-pulse font-mono">CALCULATING INDICATORS...</p>
        </div>
      )}
      <div className="flex-[4] w-full relative">
         <div ref={mainRef} className="absolute inset-0" />
      </div>
      <div className="flex-1 w-full border-t border-white/5 relative">
         <span className="absolute top-1 left-2 z-10 text-[10px] font-mono text-purple-400 pointer-events-none">RSI (14)</span>
         <div ref={rsiRef} className="absolute inset-0" />
      </div>
      <div className="flex-1 w-full border-t border-white/5 relative">
         <span className="absolute top-1 left-2 z-10 text-[10px] font-mono text-blue-400 pointer-events-none">MACD</span>
         <div ref={macdRef} className="absolute inset-0" />
      </div>
      <div className="flex-1 w-full border-t border-white/5 relative">
         <span className="absolute top-1 left-2 z-10 text-[10px] font-mono text-amber-500 pointer-events-none">ADX (14)</span>
         <div ref={adxRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
