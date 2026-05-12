"use client";
import React, { useState, useEffect } from "react";
import { Play, Download, FileText, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { createChart, ColorType, AreaSeries, LineSeries, CandlestickSeries, IChartApi, SeriesMarker, createSeriesMarkers } from "lightweight-charts";

type HistoryFile = {
  filename: string;
  size_kb: number;
  created_at: string;
};

type EquityPoint = {
  time: number;
  equity: number;
};

type PricePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type BacktestResults = {
  summary: {
    initial_balance: number;
    final_balance: number;
    total_pnl: number;
    pnl_pct: number;
    total_trades: number;
    win_rate: number;
  };
  trades: any[];
  equity_curve: EquityPoint[];
  price_data: PricePoint[];
  markers: any[];
};

export const BacktestDashboard = () => {
  const [files, setFiles] = useState<HistoryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [progress, setProgress] = useState(0);

  const fetchFiles = async () => {
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '::1' ? '127.0.0.1' : window.location.hostname;
      const res = await fetch(`http://${host}:8000/api/v1/backtest/files`);
      const data = await res.json();
      setFiles(data);
      if (data.length > 0 && !selectedFile) setSelectedFile(data[0].filename);
    } catch (e) {
      console.error("Failed to fetch history files");
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(async () => {
        try {
          const host = window.location.hostname === 'localhost' || window.location.hostname === '::1' ? '127.0.0.1' : window.location.hostname;
          const res = await fetch(`http://${host}:8000/api/v1/backtest/progress`);
          if (!res.ok) return;
          const data = await res.json();
          setProgress(data.progress);
          if (!data.is_running && data.progress === 100) {
            clearInterval(interval);
          }
        } catch (e) { }
      }, 300);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '::1' ? '127.0.0.1' : window.location.hostname;
      await fetch(`http://${host}:8000/api/v1/backtest/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "BTC/USDT", timeframe: "1h", days: 30 })
      });
      await fetchFiles();
    } catch (e) {
      alert("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const runBacktest = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setResults(null);
    setProgress(0);
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '::1' ? '127.0.0.1' : window.location.hostname;
      const res = await fetch(`http://${host}:8000/api/v1/backtest/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedFile, initial_balance: 100000.0 })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Backtest execution failed");
      }
      const data = await res.json();
      setResults(data);
    } catch (e: any) {
      alert(`Backtest failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050505] p-6 overflow-y-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Strategy Backtester</h1>
          <p className="text-zinc-500 text-sm mt-1">Validate your algorithms against historical market data with realistic slippage.</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
        >
          <Download className="w-4 h-4" />
          {downloading ? "Downloading..." : "Download Last 30 Days (BTC/USDT)"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-5 space-y-4">
            <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Select History Data</label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map(f => (
                <div
                  key={f.filename}
                  onClick={() => setSelectedFile(f.filename)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedFile === f.filename ? 'bg-blue-600/10 border-blue-500/50' : 'bg-black/40 border-white/5 hover:border-white/20'}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className={`w-4 h-4 ${selectedFile === f.filename ? 'text-blue-400' : 'text-zinc-500'}`} />
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-zinc-200 truncate w-32">{f.filename}</span>
                      <span className="text-[9px] text-zinc-500">{f.size_kb} KB</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={runBacktest}
              disabled={loading || !selectedFile}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-lg font-bold text-sm transition-all h-12"
            >
              {loading ? (
                <div className="w-full px-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                    <span>Simulating...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Run Backtest
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {results ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ResultCard title="Total PNL" value={`$${results.summary.total_pnl.toFixed(2)}`} subValue={`${results.summary.pnl_pct.toFixed(2)}%`} positive={results.summary.total_pnl >= 0} />
                <ResultCard title="Win Rate" value={`${results.summary.win_rate.toFixed(1)}%`} subValue={`${results.summary.total_trades} Trades`} />
                <ResultCard title="Initial Balance" value={`$${results.summary.initial_balance.toLocaleString()}`} />
                <ResultCard title="Final Equity" value={`$${results.summary.final_balance.toFixed(2)}`} />
              </div>

              <BacktestVisualizer
                priceData={results.price_data}
                equityData={results.equity_curve}
                markers={results.markers}
              />

              {/* Trade History Table */}
              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-zinc-500 tracking-widest uppercase">Simulation Trade Log</h3>
                  <span className="text-[10px] text-zinc-500 font-mono">Last {results.trades.length} entries</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black/50 text-zinc-500 font-bold uppercase tracking-widest text-[9px]">
                      <tr>
                        <th className="px-6 py-4">Exit Time</th>
                        <th className="px-6 py-4">Side</th>
                        <th className="px-6 py-4">Entry</th>
                        <th className="px-6 py-4">Exit</th>
                        <th className="px-6 py-4">PNL</th>
                        <th className="px-6 py-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {results.trades.map((t, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-mono text-zinc-400">{t.exit_time.split('T')[0]} {t.exit_time.split('T')[1].split('.')[0]}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${t.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {t.side}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono">${t.entry.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 font-mono">${t.exit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className={`px-6 py-4 font-mono font-bold ${t.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] text-zinc-500 italic">{t.reason}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-2xl bg-black/20">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-zinc-700" />
              </div>
              <h3 className="text-zinc-300 font-bold">Historical Simulation Lab</h3>
              <p className="text-zinc-500 text-sm max-w-xs mt-2">Pick a dataset and run your strategy. We will simulate every candle with commission and slippage impact.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ResultCard = ({ title, value, subValue, positive }: { title: string, value: string, subValue?: string, positive?: boolean }) => (
  <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl">
    <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">{title}</span>
    <div className="mt-2 flex items-baseline gap-2">
      <span className={`text-xl font-bold font-mono ${positive !== undefined ? (positive ? 'text-emerald-500' : 'text-rose-500') : 'text-white'}`}>{value}</span>
      {subValue && <span className="text-[10px] text-zinc-500">{subValue}</span>}
    </div>
  </div>
);

const BacktestVisualizer = ({ priceData, equityData, markers }: { priceData: PricePoint[], equityData: EquityPoint[], markers: any[] }) => {
  const priceContainerRef = React.useRef<HTMLDivElement>(null);
  const equityContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!priceContainerRef.current || !equityContainerRef.current) return;

    const commonOptions = {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#71717a" },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true },
    };

    const priceChart = createChart(priceContainerRef.current, {
      ...commonOptions,
      width: priceContainerRef.current.clientWidth,
      height: priceContainerRef.current.clientHeight,
    });

    const equityChart = createChart(equityContainerRef.current, {
      ...commonOptions,
      width: equityContainerRef.current.clientWidth,
      height: equityContainerRef.current.clientHeight,
    });

    // Helper function to apply markers using the best available API
    const applyMarkers = (series: any, markerList: any[]) => {
      if (!markerList || markerList.length === 0) return;
      const formatted = markerList.map(m => ({
        time: Number(m.time) as any,
        position: m.position as any,
        color: m.color,
        shape: m.shape as any,
        text: m.text,
        size: 1
      })).sort((a, b) => (a.time as number) - (b.time as number));

      try {
        if (typeof createSeriesMarkers === 'function') {
          createSeriesMarkers(series, formatted);
        } else if (typeof (series as any).createSeriesMarkers === 'function') {
          (series as any).createSeriesMarkers(formatted);
        } else if (typeof series.setMarkers === 'function') {
          series.setMarkers(formatted);
        }
      } catch (err) {
        console.error('Failed to apply markers', err);
      }
    };

    // 1. Price Series
    let priceSeries: any;
    // @ts-ignore
    if (priceChart.addCandlestickSeries) {
      // @ts-ignore
      priceSeries = priceChart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });
    } else {
      priceSeries = priceChart.addSeries(CandlestickSeries, {
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });
    }

    priceSeries.setData(priceData.map(p => ({
      time: Number(p.time) as any,
      open: p.open, high: p.high, low: p.low, close: p.close
    })));

    // Apply real markers to Price Chart
    applyMarkers(priceSeries, markers);

    // 2. Equity Series
    let areaSeries: any;
    // @ts-ignore
    if (equityChart.addAreaSeries) {
      // @ts-ignore
      areaSeries = equityChart.addAreaSeries({
        lineColor: "#3b82f6",
        topColor: "rgba(59, 130, 246, 0.4)",
        bottomColor: "rgba(59, 130, 246, 0.05)",
        lineWidth: 2,
      });
    } else {
      areaSeries = equityChart.addSeries(AreaSeries, {
        lineColor: "#3b82f6",
        topColor: "rgba(59, 130, 246, 0.4)",
        bottomColor: "rgba(59, 130, 246, 0.05)",
        lineWidth: 2,
      });
    }

    areaSeries.setData(equityData.map(p => ({
      time: Number(p.time) as any,
      value: p.equity
    })));

    // Apply real markers to Equity Chart (using inBar position for lines)
    applyMarkers(areaSeries, markers.map(m => ({ ...m, position: 'inBar' })));

    // Synchronization
    let isSyncing = false;
    const sync = (src: any, dst: any) => {
      src.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (range && !isSyncing) {
          isSyncing = true;
          dst.timeScale().setVisibleLogicalRange(range);
          isSyncing = false;
        }
      });
    };

    sync(priceChart, equityChart);
    sync(equityChart, priceChart);

    priceChart.timeScale().fitContent();
    equityChart.timeScale().fitContent();

    const handleResize = () => {
      priceChart.applyOptions({ width: priceContainerRef.current?.clientWidth });
      equityChart.applyOptions({ width: equityContainerRef.current?.clientWidth });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      priceChart.remove();
      equityChart.remove();
    };
  }, [priceData, equityData, markers]);

  return (
    <div className="grid grid-cols-1 gap-6 pb-10">
      {/* Price Chart */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-zinc-500 tracking-widest uppercase">Price & Entry/Exit Points</h3>
          <div className="flex gap-4 text-[10px] font-mono">
            <span className="flex items-center gap-2 text-emerald-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" /> Buy
            </span>
            <span className="flex items-center gap-2 text-rose-500">
              <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_5px_#ef4444]" /> Sell
            </span>
            <span className="flex items-center gap-2 text-amber-500">
              <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_#f59e0b]" /> Exit
            </span>
          </div>
        </div>
        <div ref={priceContainerRef} className="h-[450px] w-full" />
      </div>

      {/* Equity Chart */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
        <h3 className="text-xs font-bold text-zinc-500 tracking-widest uppercase mb-4">Account Equity (USD)</h3>
        <div ref={equityContainerRef} className="h-[250px] w-full" />
      </div>
    </div>
  );
};
