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
  
  // Legend refs
  const mainLegendRef = useRef<HTMLDivElement>(null);
  const rsiLegendRef = useRef<HTMLDivElement>(null);
  const macdLegendRef = useRef<HTMLDivElement>(null);
  const adxLegendRef = useRef<HTMLDivElement>(null);
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
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, rightOffset: 3, shiftVisibleRangeOnNewBar: true },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' }
    };

    // All charts share time axis visibility for alignment
    // Main chart hides time labels (shown on bottom ADX), sub-panels show them
    const noTimeLabels = { ...commonOptions, timeScale: { ...commonOptions.timeScale, visible: true, tickMarkFormatter: () => '' } };

    // 1. Main Chart
    const mainChart = createChart(mainRef.current, { ...commonOptions, height: mainRef.current.clientHeight });
    const candleSeries = mainChart.addSeries(CandlestickSeries, { upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444' });
    const volumeSeries = mainChart.addSeries(HistogramSeries, { color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.65, bottom: 0 } });

    // Overlays
    const ema20 = mainChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, crosshairMarkerVisible: false });
    const ema50 = mainChart.addSeries(LineSeries, { color: '#eab308', lineWidth: 1, crosshairMarkerVisible: false });
    const ema200 = mainChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 2, crosshairMarkerVisible: false });
    const vwap = mainChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false });
    const bbHigh = mainChart.addSeries(LineSeries, { color: '#6b7280', lineWidth: 1, lineStyle: 3, crosshairMarkerVisible: false });
    const bbLow = mainChart.addSeries(LineSeries, { color: '#6b7280', lineWidth: 1, lineStyle: 3, crosshairMarkerVisible: false });

    // 2. RSI Chart
    const rsiChart = createChart(rsiRef.current, { ...noTimeLabels, height: rsiRef.current.clientHeight });
    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, crosshairMarkerVisible: true });
    rsiChart.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.05, bottom: 0.05 } });

    // 3. MACD Chart
    const macdChart = createChart(macdRef.current, { ...noTimeLabels, height: macdRef.current.clientHeight });
    const macdLine = macdChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, crosshairMarkerVisible: true });
    const macdSignal = macdChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, crosshairMarkerVisible: true });
    const macdHist = macdChart.addSeries(HistogramSeries, { color: '#64748b' });
    macdChart.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.05, bottom: 0.05 } });

    // 4. ADX Chart (bottom — full time axis with labels)
    const adxChart = createChart(adxRef.current, { ...commonOptions, height: adxRef.current.clientHeight });
    const adxLine = adxChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, crosshairMarkerVisible: true });
    const adxPos = adxChart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: true });
    const adxNeg = adxChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: true });
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

    // Sync crosshair across all charts and update legends
    const allCharts = [mainChart, rsiChart, macdChart, adxChart];
    let isCrosshairSyncing = false;
    
    allCharts.forEach((source) => {
      source.subscribeCrosshairMove((param) => {
        if (isCrosshairSyncing) return;
        isCrosshairSyncing = true;
        
        // 1. Sync positions
        allCharts.forEach((target) => {
          if (target !== source && param.time) {
            target.setCrosshairPosition(NaN, param.time, target.options().rightPriceScale ? (target as any)._private__seriesMap?.values()?.next()?.value : undefined);
          }
        });

        // 2. Update Legends
        const updateLegend = (ref: React.RefObject<HTMLDivElement>, content: string) => {
          if (ref.current) ref.current.innerHTML = content;
        };

        const data = param.seriesData;
        
        // Main Chart Legend
        const candleData = data.get(candleSeries) as any;
        const e20 = data.get(ema20) as any;
        const e50 = data.get(ema50) as any;
        const e200 = data.get(ema200) as any;
        const bH = data.get(bbHigh) as any;
        const bL = data.get(bbLow) as any;

        if (candleData) {
          updateLegend(mainLegendRef, `
            <div class="flex flex-col gap-0.5">
              <div class="flex gap-3 text-[11px] font-mono">
                <span class="text-zinc-100 font-bold">${symbol}</span>
                <span class="text-zinc-400">O: <span class="${candleData.close >= candleData.open ? 'text-emerald-500' : 'text-rose-500'}">${candleData.open.toFixed(2)}</span></span>
                <span class="text-zinc-400">H: <span class="text-emerald-500">${candleData.high.toFixed(2)}</span></span>
                <span class="text-zinc-400">L: <span class="text-rose-500">${candleData.low.toFixed(2)}</span></span>
                <span class="text-zinc-400">C: <span class="${candleData.close >= candleData.open ? 'text-emerald-500' : 'text-rose-500'}">${candleData.close.toFixed(2)}</span></span>
              </div>
              <div class="flex gap-3 text-[10px] font-mono">
                ${e20 ? `<span class="text-blue-400">EMA20: ${e20.value.toFixed(2)}</span>` : ''}
                ${e50 ? `<span class="text-amber-500">EMA50: ${e50.value.toFixed(2)}</span>` : ''}
                ${e200 ? `<span class="text-rose-500">EMA200: ${e200.value.toFixed(2)}</span>` : ''}
                ${bH ? `<span class="text-zinc-500">BB High: ${bH.value.toFixed(2)}</span>` : ''}
                ${bL ? `<span class="text-zinc-500">BB Low: ${bL.value.toFixed(2)}</span>` : ''}
              </div>
            </div>
          `);
        }

        // RSI Legend
        const rsiVal = data.get(rsiSeries) as any;
        if (rsiVal) {
          updateLegend(rsiLegendRef, `<span class="text-purple-400">RSI(14): ${rsiVal.value.toFixed(2)}</span>`);
        }

        // MACD Legend
        const mLine = data.get(macdLine) as any;
        const mSignal = data.get(macdSignal) as any;
        const mHist = data.get(macdHist) as any;
        if (mLine && mSignal && mHist) {
          updateLegend(macdLegendRef, `
            <div class="flex gap-2 text-blue-400">
              <span>MACD: ${mLine.value.toFixed(2)}</span>
              <span class="text-amber-500">Signal: ${mSignal.value.toFixed(2)}</span>
              <span class="${mHist.value >= 0 ? 'text-emerald-500' : 'text-rose-500'}">Hist: ${mHist.value.toFixed(2)}</span>
            </div>
          `);
        }

        // ADX Legend
        const aLine = data.get(adxLine) as any;
        const aPos = data.get(adxPos) as any;
        const aNeg = data.get(adxNeg) as any;
        if (aLine && aPos && aNeg) {
          updateLegend(adxLegendRef, `
            <div class="flex gap-2 text-amber-500">
              <span>ADX(14): ${aLine.value.toFixed(2)}</span>
              <span class="text-emerald-500">+DI: ${aPos.value.toFixed(2)}</span>
              <span class="text-rose-500">-DI: ${aNeg.value.toFixed(2)}</span>
            </div>
          `);
        }

        isCrosshairSyncing = false;
      });
    });

    let ws: WebSocket;

    const fetchData = async () => {
      try {
        const host = window.location.hostname || 'localhost';
        const response = await fetch(`http://${host}:8000/api/v1/market/indicators?symbol=${symbol}&timeframe=1h&limit=1000`);
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

          // Fit main chart and force-sync all sub-charts to the exact same view
          mainChart.timeScale().fitContent();
          // Use requestAnimationFrame to ensure main chart has rendered before syncing
          requestAnimationFrame(() => {
            const range = mainChart.timeScale().getVisibleLogicalRange();
            if (range) {
              [rsiChart, macdChart, adxChart].forEach(c => {
                try { c.timeScale().setVisibleLogicalRange(range); } catch(_) {}
              });
            }
          });

          setLoading(false);

          // Update legends with the last available data point
          const lastData = data[data.length - 1];
          if (lastData) {
            if (mainLegendRef.current) mainLegendRef.current.innerHTML = `
              <div class="flex flex-col gap-0.5">
                <div class="flex gap-3 text-[11px] font-mono">
                  <span class="text-zinc-100 font-bold">${symbol}</span>
                  <span class="text-zinc-400">O: <span class="${lastData.close >= lastData.open ? 'text-emerald-500' : 'text-rose-500'}">${lastData.open.toFixed(2)}</span></span>
                  <span class="text-zinc-400">H: <span class="text-emerald-500">${lastData.high.toFixed(2)}</span></span>
                  <span class="text-zinc-400">L: <span class="text-rose-500">${lastData.low.toFixed(2)}</span></span>
                  <span class="text-zinc-400">C: <span class="${lastData.close >= lastData.open ? 'text-emerald-500' : 'text-rose-500'}">${lastData.close.toFixed(2)}</span></span>
                </div>
                <div class="flex gap-3 text-[10px] font-mono">
                  ${lastData.ema_20 ? `<span class="text-blue-400">EMA20: ${lastData.ema_20.toFixed(2)}</span>` : ''}
                  ${lastData.ema_50 ? `<span class="text-amber-500">EMA50: ${lastData.ema_50.toFixed(2)}</span>` : ''}
                  ${lastData.ema_200 ? `<span class="text-rose-500">EMA200: ${lastData.ema_200.toFixed(2)}</span>` : ''}
                  ${lastData.bb_high ? `<span class="text-zinc-500">BB High: ${lastData.bb_high.toFixed(2)}</span>` : ''}
                  ${lastData.bb_low ? `<span class="text-zinc-500">BB Low: ${lastData.bb_low.toFixed(2)}</span>` : ''}
                </div>
              </div>
            `;
            if (rsiLegendRef.current && lastData.rsi) rsiLegendRef.current.innerHTML = `<span class="text-purple-400">RSI(14): ${lastData.rsi.toFixed(2)}</span>`;
            if (macdLegendRef.current && lastData.macd) macdLegendRef.current.innerHTML = `
              <div class="flex gap-2 text-blue-400">
                <span>MACD: ${lastData.macd.toFixed(2)}</span>
                <span class="text-amber-500">Signal: ${lastData.macd_signal?.toFixed(2)}</span>
                <span class="${lastData.macd_hist >= 0 ? 'text-emerald-500' : 'text-rose-500'}">Hist: ${lastData.macd_hist?.toFixed(2)}</span>
              </div>
            `;
            if (adxLegendRef.current && lastData.adx) adxLegendRef.current.innerHTML = `
              <div class="flex gap-2 text-amber-500">
                <span>ADX(14): ${lastData.adx.toFixed(2)}</span>
                <span class="text-emerald-500">+DI: ${lastData.adx_pos?.toFixed(2)}</span>
                <span class="text-rose-500">-DI: ${lastData.adx_neg?.toFixed(2)}</span>
              </div>
            `;
          }

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
        <div ref={mainLegendRef} className="absolute top-2 left-2 z-20 pointer-events-none" />
        <div ref={mainRef} className="absolute inset-0" />
      </div>

      <Divider onDrag={makeDragHandler(0)} />

      {/* RSI */}
      <div className="w-full relative" style={{ height: `${panelPcts[1]}%` }}>
        <div ref={rsiLegendRef} className="absolute top-1 left-2 z-10 text-[10px] font-mono pointer-events-none">RSI (14)</div>
        <div ref={rsiRef} className="absolute inset-0" />
      </div>

      <Divider onDrag={makeDragHandler(1)} />

      {/* MACD */}
      <div className="w-full relative" style={{ height: `${panelPcts[2]}%` }}>
        <div ref={macdLegendRef} className="absolute top-1 left-2 z-10 text-[10px] font-mono pointer-events-none">MACD</div>
        <div ref={macdRef} className="absolute inset-0" />
      </div>

      <Divider onDrag={makeDragHandler(2)} />

      {/* ADX */}
      <div className="w-full relative" style={{ height: `${panelPcts[3]}%` }}>
        <div ref={adxLegendRef} className="absolute top-1 left-2 z-10 text-[10px] font-mono pointer-events-none">ADX (14)</div>
        <div ref={adxRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
