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

export const RecentTradesWidget = () => {
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
                  PNL: {trade.realized_pnl > 0 ? "+" : ""}{trade.realized_pnl.toFixed(2)} USDT
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
          </div>
        );
      })}
    </div>
  );
};
