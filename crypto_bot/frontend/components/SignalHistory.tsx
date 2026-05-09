"use client";
import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type OfficialSignal = {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT" | "EXIT" | "HOLD";
  confidence: number;
  price: number;
  reasoning: string[];
  unrealized_pnl: number;
  status: "OPEN" | "CLOSED";
  exit_price?: number;
};

export const SignalHistory = () => {
  const [history, setHistory] = useState<OfficialSignal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const host = window.location.hostname || "localhost";
      const res = await fetch(`http://${host}:8000/api/v1/execution/signals/history`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setHistory(data);
    } catch {
      // silent retry
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const iv = setInterval(fetchHistory, 10000); // refresh every 10s
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div className="p-4 text-xs font-mono text-zinc-600 opacity-50 animate-pulse">Loading engine history...</div>;
  if (history.length === 0) return <div className="p-4 text-xs font-mono text-zinc-600 opacity-50">No official signals emitted yet. Engine is running.</div>;

  return (
    <div className="flex flex-col gap-1 p-2 h-full overflow-y-auto">
      {history.map((sig) => {
        const isLong = sig.direction === "LONG";
        const isShort = sig.direction === "SHORT";
        const isExit = sig.direction === "EXIT";
        const Icon = isLong ? TrendingUp : (isShort ? TrendingDown : Minus);
        const color = isLong ? "text-emerald-500" : (isShort ? "text-rose-500" : "text-amber-500");
        const pnlColor = sig.unrealized_pnl > 0 ? "text-emerald-500" : (sig.unrealized_pnl < 0 ? "text-rose-500" : "text-zinc-500");
        
        return (
          <div key={sig.id} className="border-b border-white/5 last:border-0 py-1.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 ${color}`}>
                <Icon className="w-3 h-3" />
                <span className="text-[10px] font-bold">{sig.direction}</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-500">
                {new Date(sig.id).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-300">
                @{sig.price.toFixed(2)}
              </span>
              <span className="text-[9px] font-mono text-zinc-400">
                Conf: {(sig.confidence * 100).toFixed(1)}%
              </span>
            </div>

            {/* Quality / PNL display */}
            {!isExit && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-500">Status: {sig.status}</span>
                <span className={`text-[10px] font-mono font-bold ${pnlColor}`}>
                  {sig.status === "OPEN" ? "Unrealized: " : "Closed: "}
                  {sig.unrealized_pnl > 0 ? "+" : ""}{sig.unrealized_pnl.toFixed(2)}%
                </span>
              </div>
            )}
            
            <div className="text-[8px] font-mono text-zinc-500 flex gap-1 flex-wrap mt-0.5">
               {sig.reasoning.map((r, i) => (
                 <span key={i} className="bg-white/5 px-1 py-0.5 rounded">{r}</span>
               ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
