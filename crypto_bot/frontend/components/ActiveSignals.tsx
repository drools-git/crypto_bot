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

const SIGNAL_CONFIG = {
  LONG:  { color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", Icon: TrendingUp },
  SHORT: { color: "text-rose-500",    bg: "bg-rose-500/10    border-rose-500/20",    Icon: TrendingDown },
  EXIT:  { color: "text-amber-500",   bg: "bg-amber-500/10   border-amber-500/20",   Icon: LogOut },
  HOLD:  { color: "text-zinc-500",    bg: "bg-zinc-500/10    border-zinc-500/20",    Icon: Minus },
};

export const ActiveSignals = ({ symbol = "BTC/USDT" }: { symbol?: string }) => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = async () => {
    try {
      const host = window.location.hostname || "localhost";
      const res = await fetch(
        `http://${host}:8000/api/v1/strategies/signals?symbol=${encodeURIComponent(symbol)}&timeframe=1h&limit=300`
      );
      if (!res.ok) throw new Error("Fetch failed");
      const data: Signal[] = await res.json();
      setSignals(data);
    } catch {
      // silently retry on next interval
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const iv = setInterval(fetchSignals, 60_000); // refresh every minute
    return () => clearInterval(iv);
  }, [symbol]);

  const active = signals.filter((s) => s.signal !== "HOLD");

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto">
      {loading && (
        <span className="text-[10px] font-mono text-zinc-500 animate-pulse">
          Analyzing strategies...
        </span>
      )}
      {!loading && active.length === 0 && (
        <span className="text-[10px] font-mono text-zinc-600 opacity-50">
          No active signals
        </span>
      )}
      {active.map((sig) => {
        const cfg = SIGNAL_CONFIG[sig.signal] ?? SIGNAL_CONFIG.HOLD;
        const { Icon } = cfg;
        return (
          <div
            key={sig.strategy_id}
            className={`rounded border px-2 py-1.5 ${cfg.bg} flex flex-col gap-0.5`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                {sig.strategy_name}
              </span>
              <div className={`flex items-center gap-1 ${cfg.color}`}>
                <Icon className="w-3 h-3" />
                <span className="text-[10px] font-bold">{sig.signal}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-zinc-500 line-clamp-1 flex-1 pr-2">
                {sig.reasoning}
              </span>
              <span className={`text-[10px] font-mono font-bold shrink-0 ${cfg.color}`}>
                {(sig.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}

      {/* Consensus bar */}
      {!loading && signals.length > 0 && (
        <ConsensusBar signals={signals} />
      )}
    </div>
  );
};

function ConsensusBar({ signals }: { signals: Signal[] }) {
  const counts = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.signal] = (acc[s.signal] ?? 0) + 1;
    return acc;
  }, {});

  const total = signals.length || 1;

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
        Consensus
      </span>
      <div className="flex gap-0.5 mt-1 h-1.5 rounded overflow-hidden">
        {(["LONG", "SHORT", "EXIT", "HOLD"] as const).map((sig) => {
          const pct = ((counts[sig] ?? 0) / total) * 100;
          const colors = {
            LONG: "bg-emerald-500", SHORT: "bg-rose-500",
            EXIT: "bg-amber-500",   HOLD:  "bg-zinc-600",
          };
          return pct > 0 ? (
            <div
              key={sig}
              className={`${colors[sig]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${sig}: ${counts[sig] ?? 0}`}
            />
          ) : null;
        })}
      </div>
      <div className="flex gap-3 mt-1">
        {(["LONG", "SHORT", "EXIT"] as const).map((sig) =>
          (counts[sig] ?? 0) > 0 ? (
            <span key={sig} className={`text-[9px] font-mono ${SIGNAL_CONFIG[sig].color}`}>
              {sig}: {counts[sig]}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}
