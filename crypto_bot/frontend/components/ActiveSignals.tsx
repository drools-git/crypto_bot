"use client";
import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, LogOut } from "lucide-react";

type Signal = {
  strategy_id: string;
  strategy_name: string;
  signal: "LONG" | "SHORT" | "EXIT" | "HOLD";
  confidence: number;
  reasoning: string;
  symbol: string;
};

type ConsensusData = {
  direction: string;
  confidence: number;
  votes: Record<string, number>;
  n_signals: number;
  n_active: number;
  signals: Signal[];
};

const SIGNAL_CONFIG = {
  LONG:  { color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", Icon: TrendingUp },
  SHORT: { color: "text-rose-500",    bg: "bg-rose-500/10    border-rose-500/20",    Icon: TrendingDown },
  EXIT:  { color: "text-amber-500",   bg: "bg-amber-500/10   border-amber-500/20",   Icon: LogOut },
  HOLD:  { color: "text-zinc-500",    bg: "bg-zinc-500/10    border-zinc-500/20",    Icon: Minus },
};

export const ActiveSignals = ({ symbol = "BTC/USDT", timeframe = "1h" }: { symbol?: string, timeframe?: string }) => {
  const [data, setData] = useState<ConsensusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = async () => {
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '::1' ? '127.0.0.1' : window.location.hostname;
      const res = await fetch(
        `http://${host}:8000/api/v1/strategies/consensus?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=300`
      );
      if (!res.ok) throw new Error("Fetch failed");
      const json: ConsensusData = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSignals();
    const iv = setInterval(fetchSignals, 60_000); // refresh every minute
    return () => clearInterval(iv);
  }, [symbol, timeframe]);

  const active = data?.signals || [];

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto">
      {loading && (
        <span className="text-[10px] font-mono text-zinc-500 animate-pulse">
          Analyzing strategies...
        </span>
      )}
      {error && !loading && (
        <span className="text-[10px] font-mono text-rose-500 bg-rose-500/10 p-2 rounded border border-rose-500/20">
          Error: {error}
        </span>
      )}
      {!loading && !error && active.length === 0 && (
        <span className="text-[10px] font-mono text-zinc-600 opacity-50">
          No active signals
        </span>
      )}
      {active.map((sig) => (
        <SignalItem key={sig.strategy_id} sig={sig} />
      ))}

      {/* Consensus bar */}
      {!loading && data && (
        <ConsensusBar data={data} />
      )}
    </div>
  );
};

function ConsensusBar({ data }: { data: ConsensusData }) {
  const { direction, confidence, votes } = data;
  const cfg = SIGNAL_CONFIG[direction as keyof typeof SIGNAL_CONFIG] ?? SIGNAL_CONFIG.HOLD;
  const { Icon } = cfg;

  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0) || 1;

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
          Consensus
        </span>
        <div className={`flex items-center gap-1 ${cfg.color}`}>
          <Icon className="w-3 h-3" />
          <span className="text-[10px] font-bold">{direction} ({(confidence * 100).toFixed(1)}%)</span>
        </div>
      </div>
      <div className="flex gap-0.5 h-1.5 rounded overflow-hidden">
        {(["LONG", "SHORT", "EXIT", "HOLD"] as const).map((sig) => {
          const v = votes[sig] ?? 0;
          const pct = (v / totalVotes) * 100;
          const colors = {
            LONG: "bg-emerald-500", SHORT: "bg-rose-500",
            EXIT: "bg-amber-500",   HOLD:  "bg-zinc-600",
          };
          return pct > 0 ? (
            <div
              key={sig}
              className={`${colors[sig]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${sig}: ${v.toFixed(2)}`}
            />
          ) : null;
        })}
      </div>
    </div>
  );
}

function SignalItem({ sig }: { sig: Signal }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SIGNAL_CONFIG[sig.signal] ?? SIGNAL_CONFIG.HOLD;
  const { Icon } = cfg;
  
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`rounded border px-2 py-1.5 cursor-pointer hover:border-zinc-500/50 transition-colors ${cfg.bg} flex flex-col gap-1`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">
          {sig.strategy_name}
        </span>
        <div className={`flex items-center gap-1 ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold">{sig.signal}</span>
        </div>
      </div>
      <div className="flex items-start justify-between">
        <span className={`text-[10px] font-mono flex-1 pr-2 transition-all ${expanded ? 'text-zinc-300' : 'text-zinc-400 line-clamp-1'}`}>
          {sig.reasoning}
        </span>
        <span className={`text-[11px] font-mono font-bold shrink-0 ${cfg.color}`}>
          {(sig.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
