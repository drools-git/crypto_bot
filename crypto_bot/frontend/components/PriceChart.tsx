"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, LineSeries, HistogramSeries, CrosshairMode } from 'lightweight-charts';

interface PriceChartProps {
  symbol: string;
}

// Draggable divider component
const Divider: React.FC<{ onDrag: (delta: number) => void }> = ({ onDrag }) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const onMouseMove = (ev: MouseEvent) => {
      onDrag(ev.clientY - startY);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-full h-[5px] cursor-row-resize bg-white/5 hover:bg-blue-500/40 transition-colors z-20 flex-shrink-0"
    />
  );
};

export const PriceChart: React.FC<PriceChartProps> = ({ symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const adxRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // Panel heights as percentages [main, rsi, macd, adx]
  const [panelPcts, setPanelPcts] = useState([55, 15, 15, 15]);

  const chartsRef = useRef<{ main?: IChartApi; rsi?: IChartApi; macd?: IChartApi; adx?: IChartApi }>({});

  // Resize all charts when panel sizes change
  useEffect(() => {
    const charts = chartsRef.current;
    const refs = [
      { ref: mainRef, chart: charts.main },
      { ref: rsiRef, chart: charts.rsi },
      { ref: macdRef, chart: charts.macd },
      { ref: adxRef, chart: charts.adx },
    ];
    refs.forEach(({ ref, chart }) => {
      if (ref.current && chart) {
        chart.applyOptions({ width: ref.current.clientWidth, height: ref.current.clientHeight });
      }
    });
  }, [panelPcts]);

  const makeDragHandler = useCallback((panelIdx: number) => {
    // panelIdx: the divider between panelIdx and panelIdx+1
    return (delta: number) => {
      if (!containerRef.current) return;
      const totalH = containerRef.current.clientHeight;
      const deltaPct = (delta / totalH) * 100;

      setPanelPcts(prev => {
        const next = [...prev];
        const minPct = 8;
        let above = next[panelIdx] + deltaPct;
        let below = next[panelIdx + 1] - deltaPct;
        if (above < minPct) { below -= (minPct - above); above = minPct; }
        if (below < minPct) { above -= (minPct - below); below = minPct; }
        if (above < minPct || below < minPct) return prev;
        next[panelIdx] = above;
        next[panelIdx + 1] = below;
        return next;
      });
    };
  }, []);

  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !macdRef.current || !adxRef.current) return;

    const commonOptions = {
      layout: { background: { type: ColorType.Solid, color: '#000000' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.03)' }, horzLines: { color: 'rgba(255, 255, 255, 0.03)' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' }
    };

    // Sub-panel options: hide redundant time axis labels on RSI/MACD, show only on ADX (bottom)
    const subOptions = (showTime: boolean) => ({
      ...commonOptions,
      timeScale: { ...commonOptions.timeScale, visible: showTime },
    });

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

    // 2. RSI Chart — autoScale ON, scaleMargins tight
    const rsiChart = createChart(rsiRef.current, { ...subOptions(false), height: rsiRef.current.clientHeight });
    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1 });
    rsiChart.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.05, bottom: 0.05 } });

    // 3. MACD Chart
    const macdChart = createChart(macdRef.current, { ...subOptions(false), height: macdRef.current.clientHeight });
    const macdLine = macdChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1 });
    const macdSignal = macdChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1 });
    const macdHist = macdChart.addSeries(HistogramSeries, { color: '#64748b' });
    macdChart.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.05, bottom: 0.05 } });

    // 4. ADX Chart (bottom — show time axis)
    const adxChart = createChart(adxRef.current, { ...subOptions(true), height: adxRef.current.clientHeight });
    const adxLine = adxChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2 });
    const adxPos = adxChart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, lineStyle: 2 });
    const adxNeg = adxChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, lineStyle: 2 });
    adxChart.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.05, bottom: 0.05 } });

    // Store refs for resize
    chartsRef.current = { main: mainChart, rsi: rsiChart, macd: macdChart, adx: adxChart };

    // Sync timelines
    let isSyncing = false;
    const syncCharts = (source: IChartApi, targets: IChartApi[]) => {
      source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && !isSyncing) {
          isSyncing = true;
          targets.forEach(t => {
            try { t.timeScale().setVisibleLogicalRange(range); } catch (_) {}
          });
          isSyncing = false;
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

        if (Array.isArray(data) && data.length > 0) {
          const getUnixTime = (t: any) => (t > 10000000000 ? Math.floor(t / 1000) : t) as any;

          const candles = data.map((d: any) => ({ time: getUnixTime(d.time), open: d.open, high: d.high, low: d.low, close: d.close }));
          const volumes = data.map((d: any) => ({ time: getUnixTime(d.time), value: d.volume, color: d.close >= d.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)' }));

          candleSeries.setData(candles);
          volumeSeries.setData(volumes);

          ema20.setData(data.filter((d: any) => d.ema_20 != null && d.ema_20 !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.ema_20 })));
          ema50.setData(data.filter((d: any) => d.ema_50 != null && d.ema_50 !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.ema_50 })));
          ema200.setData(data.filter((d: any) => d.ema_200 != null && d.ema_200 !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.ema_200 })));
          vwap.setData(data.filter((d: any) => d.vwap != null && d.vwap !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.vwap })));
          bbHigh.setData(data.filter((d: any) => d.bb_high != null && d.bb_high !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.bb_high })));
          bbLow.setData(data.filter((d: any) => d.bb_low != null && d.bb_low !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.bb_low })));

          rsiSeries.setData(data.filter((d: any) => d.rsi != null && d.rsi !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.rsi })));

          macdLine.setData(data.filter((d: any) => d.macd != null).map((d: any) => ({ time: getUnixTime(d.time), value: d.macd })));
          macdSignal.setData(data.filter((d: any) => d.macd_signal != null).map((d: any) => ({ time: getUnixTime(d.time), value: d.macd_signal })));
          macdHist.setData(data.filter((d: any) => d.macd_hist != null).map((d: any) => ({ time: getUnixTime(d.time), value: d.macd_hist, color: d.macd_hist >= 0 ? '#10b981' : '#ef4444' })));

          adxLine.setData(data.filter((d: any) => d.adx != null && d.adx !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.adx })));
          adxPos.setData(data.filter((d: any) => d.adx_pos != null && d.adx_pos !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.adx_pos })));
          adxNeg.setData(data.filter((d: any) => d.adx_neg != null && d.adx_neg !== 0).map((d: any) => ({ time: getUnixTime(d.time), value: d.adx_neg })));

          let lastCandleTime = candles[candles.length - 1].time;

          // Fit all charts to show all data
          mainChart.timeScale().fitContent();
          rsiChart.timeScale().fitContent();
          macdChart.timeScale().fitContent();
          adxChart.timeScale().fitContent();

          setLoading(false);

          // Connect WS for live price updates
          const stream = symbol.toLowerCase().replace('/', '');
          ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}@kline_1h`);
          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.k) {
              const kline = message.k;
              let tickTime = Math.floor(kline.t / 1000) as any;

              if (tickTime < lastCandleTime) {
                if (lastCandleTime - tickTime <= 3600) {
                  tickTime = lastCandleTime;
                } else {
                  return;
                }
              } else {
                lastCandleTime = tickTime;
              }

              candleSeries.update({
                time: tickTime,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
              });
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
      chartsRef.current = {};
    };
  }, [symbol]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <p className="text-blue-500 text-sm animate-pulse font-mono">CALCULATING INDICATORS...</p>
        </div>
      )}

      {/* Main Candle Chart */}
      <div className="w-full relative" style={{ height: `${panelPcts[0]}%` }}>
        <div ref={mainRef} className="absolute inset-0" />
      </div>

      <Divider onDrag={makeDragHandler(0)} />

      {/* RSI */}
      <div className="w-full relative" style={{ height: `${panelPcts[1]}%` }}>
        <span className="absolute top-1 left-2 z-10 text-[10px] font-mono text-purple-400 pointer-events-none">RSI (14)</span>
        <div ref={rsiRef} className="absolute inset-0" />
      </div>

      <Divider onDrag={makeDragHandler(1)} />

      {/* MACD */}
      <div className="w-full relative" style={{ height: `${panelPcts[2]}%` }}>
        <span className="absolute top-1 left-2 z-10 text-[10px] font-mono text-blue-400 pointer-events-none">MACD</span>
        <div ref={macdRef} className="absolute inset-0" />
      </div>

      <Divider onDrag={makeDragHandler(2)} />

      {/* ADX */}
      <div className="w-full relative" style={{ height: `${panelPcts[3]}%` }}>
        <span className="absolute top-1 left-2 z-10 text-[10px] font-mono text-amber-500 pointer-events-none">ADX (14)</span>
        <div ref={adxRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
