"use client";
import React, { useEffect, useState } from "react";

type Position = {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entry_price: number;
  size_base: number;
  cost: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  stop_loss?: number;
  take_profit?: number;
  total_fees?: number;
};

type RiskStatus = {
  kill_switch_active: boolean;
  kill_switch_reason: string;
  daily_pnl: number;
  consecutive_losses: number;
  max_daily_dd_limit: number;
};

type Trade = {
  trade_id: string;
  timestamp: string;
  symbol: string;
  side: "LONG" | "SHORT";
  type: string;
  price: number;
  size_base: number;
  size_quote: number;
  fee: number;
  realized_pnl: number;
  stop_loss?: number;
  take_profit?: number;
  reasoning: string;
};

type PortfolioData = {
  balance: number;
  total_equity: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_fees: number;
  positions: Position[];
};

export const usePortfolio = () => {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  const fetchPortfolio = async () => {
    try {
      const host = window.location.hostname || "localhost";
      const res = await fetch(`http://${host}:8000/api/v1/execution/portfolio`);
      if (res.ok) {
        setPortfolio(await res.json());
      }
    } catch {}
  };

  useEffect(() => {
    fetchPortfolio();
    const iv = setInterval(fetchPortfolio, 5000); // fast refresh for paper trading
    return () => clearInterval(iv);
  }, []);

  return portfolio;
};

export const PerformanceWidget = () => {
  const portfolio = usePortfolio();

  if (!portfolio) {
    return <div className="p-4 text-xs font-mono text-zinc-600 opacity-50 animate-pulse">Loading...</div>;
  }

  const formatCurrency = (val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const prefix = isNegative ? "-" : (val > 0 ? "+" : "");
    return `${prefix}$${absVal.toFixed(2)}`;
  };

  const urColor = portfolio.unrealized_pnl > 0 ? "text-emerald-500" : (portfolio.unrealized_pnl < 0 ? "text-rose-500" : "text-zinc-500");
  const rColor = portfolio.realized_pnl > 0 ? "text-emerald-500" : (portfolio.realized_pnl < 0 ? "text-rose-500" : "text-zinc-500");

  return (
    <div className="p-4 flex flex-col gap-2 flex-1 justify-center overflow-hidden">
      <div className="flex justify-center mb-2">
        <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase">
          🤖 Bot Execution: 1H Intraday
        </span>
      </div>
      <div className="flex justify-between items-end">
        <span className="text-xs text-zinc-500">Unrealized PNL</span>
        <span className={`font-mono ${urColor}`}>{formatCurrency(portfolio.unrealized_pnl)}</span>
      </div>
      <div className="flex justify-between items-end">
        <span className="text-xs text-zinc-500">Realized PNL</span>
        <span className={`font-mono ${rColor}`}>{formatCurrency(portfolio.realized_pnl)}</span>
      </div>
      <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/5">
        <span className="text-xs text-zinc-500">Total Fees Paid</span>
        <span className="font-mono text-amber-500/80">{formatCurrency(portfolio.total_fees)}</span>
      </div>
      <div className="flex justify-between items-end mt-1">
        <span className="text-xs text-zinc-500">Total Equity</span>
        <span className="font-mono text-zinc-200 font-bold">${portfolio.total_equity.toFixed(2)}</span>
      </div>
    </div>
  );
};

export const OpenPositionsWidget = () => {
  const portfolio = usePortfolio();

  if (!portfolio) {
    return <div className="p-4 text-xs font-mono text-zinc-600 opacity-50 animate-pulse">Loading...</div>;
  }

  if (portfolio.positions.length === 0) {
    return (
      <div className="p-4 text-xs text-zinc-600 font-mono flex items-center justify-center h-full opacity-50">
        No active positions
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 h-full overflow-y-auto">
      {portfolio.positions.map((pos) => {
        const isLong = pos.side === "LONG";
        const color = isLong ? "text-emerald-500" : "text-rose-500";
        const pnlColor = pos.unrealized_pnl > 0 ? "text-emerald-500" : (pos.unrealized_pnl < 0 ? "text-rose-500" : "text-zinc-500");

        return (
          <div key={pos.id} className="border border-white/5 bg-white/[0.02] rounded p-2 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${color}`}>{pos.side}</span>
                <span className="text-[11px] font-bold text-zinc-200">{pos.symbol}</span>
              </div>
              <span className={`text-[11px] font-mono font-bold ${pnlColor}`}>
                {pos.unrealized_pnl > 0 ? "+" : ""}{pos.unrealized_pnl.toFixed(2)} USDT ({pos.unrealized_pnl_pct.toFixed(2)}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-1">
              <span>Size: {pos.size_base.toFixed(4)}</span>
              <span>Entry: ${pos.entry_price.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-0.5">
              <span>Cost: ${pos.cost.toFixed(2)}</span>
              <span>Mark: ${pos.current_price.toFixed(2)}</span>
            </div>
            {(pos.stop_loss || pos.take_profit) && (
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-300 mt-1.5 border-t border-white/10 pt-1.5 bg-white/[0.02] -mx-2 px-2 pb-1">
                {pos.stop_loss && <span className="text-rose-400 font-bold">Stop Loss: ${pos.stop_loss.toFixed(2)}</span>}
                {pos.take_profit && <span className="text-emerald-400 font-bold">Take Profit: ${pos.take_profit.toFixed(2)}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const RecentTradesWidget = ({ limit = 5 }: { limit?: number }) => {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const host = window.location.hostname || "localhost";
        const res = await fetch(`http://${host}:8000/api/v1/execution/trades`);
        if (res.ok) setTrades(await res.json());
      } catch {}
    };
    fetchTrades();
    const iv = setInterval(fetchTrades, 10000);
    return () => clearInterval(iv);
  }, []);

  if (trades.length === 0) {
    return <div className="p-4 text-xs font-mono text-zinc-600 opacity-50">No execution history yet.</div>;
  }

  return (
    <div className="flex flex-col gap-1 p-2 h-full overflow-y-auto">
      {trades.map((trade) => {
        const isLong = trade.side === "LONG";
        const color = isLong ? "text-emerald-500" : "text-rose-500";
        const isClose = trade.type.includes("CLOSE");
        
        return (
          <div key={trade.trade_id} className="border-b border-white/5 last:border-0 py-1.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold ${color}`}>{trade.side} {isClose ? "CLOSE" : "OPEN"}</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-500">
                {new Date(trade.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-300">
                @{trade.price.toFixed(2)}
              </span>
              <span className="text-[9px] font-mono text-zinc-400">
                Size: {trade.size_base.toFixed(4)}
              </span>
            </div>

            {isClose ? (
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-500">Fee: ${trade.fee.toFixed(2)}</span>
                <span className={`text-[10px] font-mono font-bold ${trade.realized_pnl > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  PNL: {trade.realized_pnl > 0 ? "+" : ""}{trade.realized_pnl.toFixed(2)} USDT ({(trade.realized_pnl / trade.size_quote * 100).toFixed(2)}%)
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-500">Fee: ${trade.fee.toFixed(2)}</span>
                <span className="text-[9px] font-mono text-zinc-400">Cost: ${trade.size_quote.toFixed(2)}</span>
              </div>
            )}
            
            {(trade.stop_loss > 0 || trade.take_profit > 0) && (
               <div className="flex items-center justify-between mt-0.5 text-[8px] font-mono opacity-60">
                 {trade.stop_loss > 0 && <span className="text-rose-400">SL: {trade.stop_loss.toFixed(1)}</span>}
                 {trade.take_profit > 0 && <span className="text-emerald-400">TP: {trade.take_profit.toFixed(1)}</span>}
               </div>
            )}

            {/* Reasoning block */}
            <div className="mt-1 p-1.5 bg-black/20 rounded border border-white/5 text-[9px] text-zinc-400 italic">
              ↳ {trade.reasoning || "Razón no especificada"}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const RiskStatusWidget = () => {
  const [risk, setRisk] = useState<RiskStatus | null>(null);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const host = window.location.hostname === 'localhost' || window.location.hostname === '::1' ? '127.0.0.1' : window.location.hostname;
        const res = await fetch(`http://${host}:8001/api/v1/execution/risk`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setRisk(data);
      } catch (e: any) {
        console.error(`Risk Fetch Error: ${e.message}`);
      }
    };
    fetchRisk();
    const iv = setInterval(fetchRisk, 10000);
    return () => clearInterval(iv);
  }, []);

  if (!risk) return null;

  const isWarning = risk.kill_switch_active || risk.consecutive_losses >= 3;

  return (
    <div className="p-4 flex flex-col gap-3 flex-1 h-full overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">System Safety</span>
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-500 ${risk.kill_switch_active ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
          {risk.kill_switch_active ? 'KILL SWITCH ACTIVE' : 'RISK: NOMINAL'}
        </div>
      </div>

      {risk.kill_switch_active && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded shrink-0">
          <p className="text-[10px] text-rose-400 font-mono">REASON: {risk.kill_switch_reason}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mt-1 shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Daily PNL</span>
          <span className={`text-sm font-mono font-bold ${risk.daily_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {risk.daily_pnl >= 0 ? '+' : ''}{risk.daily_pnl.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Loss Streak</span>
          <span className={`text-sm font-mono font-bold ${risk.consecutive_losses >= 3 ? 'text-orange-500' : 'text-zinc-300'}`}>
            {risk.consecutive_losses} / 5
          </span>
        </div>
      </div>
      
      <div className="w-full bg-zinc-800/50 h-1 rounded-full mt-auto overflow-hidden">
        <div 
          className={`h-full transition-all duration-700 ${isWarning ? 'bg-rose-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(100, (risk.consecutive_losses / 5) * 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

