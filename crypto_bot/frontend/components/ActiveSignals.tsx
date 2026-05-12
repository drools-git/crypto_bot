"use client";
import React, { useEffect, useState, useRef } from "react";
import { getBaseUrl } from "@/config/api";
import { serverLog } from "@/config/debug";
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSignals = async (showLoading = false) => {
    console.log(`%c [ActiveSignals] Fetching signals (symbol=${symbol}, loading=${showLoading})... `, "color: #fbbf24; font-weight: bold;");
    if (showLoading) setLoading(true);
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '::1' ? '127.0.0.1' : window.location.hostname;
      
      // Abort previous request if it exists
      if (abortControllerRef.current) abortControllerRef.current.abort();
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const res = await fetch(
        `${getBaseUrl()}/strategies/consensus?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=300`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}: Backend unreachable or error.`);
      const json: ConsensusData = await res.json();
      
      const sigCount = json.signals?.length || 0;
      const details = json.signals.map(s => `${s.strategy_name}: ${s.signal} (${(s.confidence * 100).toFixed(0)}%)`).join(' | ');
      serverLog(`PINTANDO ESTRATEGIAS: ${sigCount} señales [${details}] | Consenso: ${json.direction}`, 'success');
      
      setData(json);
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Ignore cancellations
      console.error("Signal fetch error:", err);
      setError(err.message);
    } finally {
      // Only reset loading if this is still the active controller
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("%c [ActiveSignals] COMPONENT MOUNTED ", "color: #10b981; font-weight: bold; border: 1px solid #10b981; padding: 2px;");
    // Small delay on mount to avoid request bursts when switching tabs
    const timer = setTimeout(() => fetchSignals(true), 300);
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSignals(false);
      } else {
        console.log("%c [ActiveSignals] Polling paused (Tab hidden) ", "color: #71717a;");
      }
    }, 30000); // Refresh every 30s
    
    return () => {
      serverLog("OBJETO STRATEGIES DESTRUIDO (Cambio de pestaña)", "warn");
      clearTimeout(timer);
      clearInterval(iv);
    };
  }, [symbol, timeframe]);

  const active = data?.signals || [];

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto">
      {loading && (
        <span className="text-[10px] font-mono text-zinc-500 animate-pulse">
          Analyzing strategies...
        </span>
      )}
      {error && !loading && !data && (
        <div className="text-[10px] font-mono text-rose-500 bg-rose-500/10 p-2 rounded border border-rose-500/20 mb-2">
          Error: {error}. Verifique que el backend esté funcionando.
        </div>
      )}
      {error && !loading && data && (
        <div className="text-[8px] font-mono text-rose-400/60 mb-1 italic">
          ⚠️ Connection unstable. Showing last cached signals...
        </div>
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
      <div className={`flex items-start justify-between ${expanded ? 'mb-1' : ''}`}>
        <span className={`text-[10px] font-mono flex-1 pr-2 transition-all ${expanded ? 'text-zinc-200' : 'text-zinc-400 line-clamp-1'}`}>
          {sig.reasoning}
        </span>
        <span className={`text-[11px] font-mono font-bold shrink-0 ${cfg.color}`}>
          {(sig.confidence * 100).toFixed(0)}%
        </span>
      </div>

      {expanded && sig.metadata && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-white/5 mt-1">
          {Object.entries(sig.metadata)
            .filter(([k]) => !['symbol', 'timeframe', 'weight'].includes(k))
            .map(([k, v]) => (
              <div key={k} className="flex justify-between items-center bg-black/20 px-1.5 py-0.5 rounded">
                <span className="text-[8px] uppercase text-zinc-500 font-bold tracking-tighter">{k.replace(/_/g, ' ')}</span>
                <span className="text-[9px] font-mono text-zinc-300">
                  {typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v)}
                </span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
