"use client";
import React, { useState, useEffect } from "react";
import { Play, Download, FileText, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { createChart, ColorType } from "lightweight-charts";

type HistoryFile = {
  filename: string;
  size_kb: number;
  created_at: string;
};

type BacktestSummary = {
  initial_balance: number;
  final_balance: number;
  total_pnl: number;
  pnl_pct: number;
  total_trades: number;
  win_rate: number;
};

type EquityPoint = {
  time: number;
  equity: number;
};

export const BacktestDashboard = () => {
  const [files, setFiles] = useState<HistoryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [results, setResults] = useState<{ summary: BacktestSummary, equity_curve: EquityPoint[] } | null>(null);

  const fetchFiles = async () => {
    try {
      const host = window.location.hostname || "localhost";
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

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const host = window.location.hostname || "localhost";
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
    try {
      const host = window.location.hostname || "localhost";
      const res = await fetch(`http://${host}:8000/api/v1/backtest/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedFile, initial_balance: 100000.0 })
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      alert("Backtest failed");
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
        {/* Controls */}
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
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-lg font-bold text-sm transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              {loading ? "Running Simulation..." : "Run Backtest"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-6">
          {results ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ResultCard title="Total PNL" value={`$${results.summary.total_pnl.toFixed(2)}`} subValue={`${results.summary.pnl_pct.toFixed(2)}%`} positive={results.summary.total_pnl >= 0} />
                <ResultCard title="Win Rate" value={`${results.summary.win_rate.toFixed(1)}%`} subValue={`${results.summary.total_trades} Trades`} />
                <ResultCard title="Initial Balance" value={`$${results.summary.initial_balance.toLocaleString()}`} />
                <ResultCard title="Final Equity" value={`$${results.summary.final_balance.toFixed(2)}`} />
              </div>

              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6 h-[400px]">
                <h3 className="text-xs font-bold text-zinc-500 tracking-widest uppercase mb-4">Equity Curve</h3>
                <EquityChart data={results.equity_curve} />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-2xl">
               <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8 text-zinc-700" />
               </div>
               <h3 className="text-zinc-300 font-bold">No Simulation Data</h3>
               <p className="text-zinc-500 text-sm max-w-xs mt-2">Select a historical data file and click 'Run Backtest' to see how your strategy would have performed.</p>
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

const EquityChart = ({ data }: { data: EquityPoint[] }) => {
  const chartContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#71717a" },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: { borderColor: "rgba(255,255,255,0.1)" },
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: "#3b82f6",
      topColor: "rgba(59, 130, 246, 0.4)",
      bottomColor: "rgba(59, 130, 246, 0.05)",
      lineWidth: 2,
    });

    const chartData = data.map(p => ({
       time: p.time as any,
       value: p.equity
    }));

    areaSeries.setData(chartData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};
