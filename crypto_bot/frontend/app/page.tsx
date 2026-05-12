"use client";

import React, { useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { OrderBook } from "@/components/OrderBook";
import { TradeTape } from "@/components/TradeTape";
import { NewsFeed } from "@/components/NewsFeed";
import { Activity, Settings } from "lucide-react";
import { ActiveSignals } from "@/components/ActiveSignals";
import { SignalHistory } from "@/components/SignalHistory";
import { PerformanceWidget, OpenPositionsWidget, RecentTradesWidget, RiskStatusWidget } from "@/components/Portfolio";
import { BacktestDashboard } from "@/components/BacktestDashboard";

import { StrategyManagerView } from "@/components/StrategyManager";
import { serverLog } from "@/config/debug";

export default function TerminalDashboard() {
  const [timeframe, setTimeframe] = useState("1h");
  const [activeView, setActiveView] = useState<"terminal" | "backtest" | "strategies">("terminal");

  React.useEffect(() => {
    serverLog(`CAMBIO A TAB: ${activeView.toUpperCase()}`, 'info');
  }, [activeView]);

  return (
    <div className="h-screen w-screen bg-[#050505] text-zinc-200 flex flex-col overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="h-12 border-b border-white/5 bg-[#0a0a0a] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-widest text-zinc-100">ANTIGRAVITY</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10"></div>
          <div className="flex gap-4 text-xs font-medium text-zinc-400">
            <span 
              onClick={() => setActiveView("terminal")}
              className={`${activeView === "terminal" ? "text-blue-500" : "hover:text-zinc-200"} cursor-pointer transition-colors`}
            >
              Terminal
            </span>
            <span 
              onClick={() => setActiveView("backtest")}
              className={`${activeView === "backtest" ? "text-blue-500" : "hover:text-zinc-200"} cursor-pointer transition-colors`}
            >
              Backtest
            </span>
            <span 
              onClick={() => setActiveView("strategies")}
              className={`${activeView === "strategies" ? "text-blue-500" : "hover:text-zinc-200"} cursor-pointer transition-colors`}
            >
              Strategies
            </span>
            <span className="hover:text-zinc-200 cursor-pointer transition-colors">Portfolios</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10 ml-2"></div>
          {/* ... */}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* VIEW: BACKTEST */}
        <div className={`absolute inset-0 ${activeView === "backtest" ? "block" : "hidden"}`}>
          <BacktestDashboard />
        </div>

        {/* VIEW: STRATEGIES */}
        <div className={`absolute inset-0 ${activeView === "strategies" ? "block" : "hidden"}`}>
          <StrategyManagerView />
        </div>

        {/* VIEW: TERMINAL (Main Dashboard) */}
        <div className={`flex-1 flex flex-col overflow-hidden ${activeView === "terminal" ? "flex" : "hidden"}`}>
          <div className="flex-1 flex overflow-hidden">
            {/* LEFT PANEL */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-[#0a0a0a] shrink-0 h-full">
              <PanelSection title="WATCHLIST" className="shrink-0">
                <div className="flex justify-between items-center py-1 cursor-pointer hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
                  <div className="flex gap-2 items-center">
                    <span className="font-mono text-xs font-bold text-zinc-200">BTC/USDT</span>
                  </div>
                  <span className="font-mono text-xs text-emerald-500">+2.4%</span>
                </div>
              </PanelSection>
              <PanelSection title="ACTIVE SIGNALS" className="flex-[3] overflow-hidden" flex>
                <ActiveSignals symbol="BTC/USDT" timeframe={timeframe} />
              </PanelSection>
              <PanelSection title="LATEST NEWS" className="flex-[2] overflow-hidden">
                <NewsFeed />
              </PanelSection>
            </div>

            {/* CENTER PANEL (Chart) */}
            <div className="flex-1 flex flex-col bg-black overflow-hidden">
              <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
                <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">{timeframe} CHART - BTC/USDT</span>
              </div>
              <PriceChart symbol="BTC/USDT" timeframe={timeframe} />
            </div>

            {/* RIGHT PANEL */}
            <div className="w-[300px] border-l border-white/5 flex flex-col bg-[#0a0a0a] shrink-0">
              <PanelSection title="ORDER BOOK" flex>
                <OrderBook symbol="BTC/USDT" />
              </PanelSection>
              
              <PanelSection title="MARKET TRADES" flex>
                <TradeTape symbol="BTC/USDT" />
              </PanelSection>
            </div>
          </div>
          <BottomPanel />
        </div>

      </div>
    </div>
  );
}

function PanelSection({ title, children, flex = false, className = "" }: { title: string, children: React.ReactNode, flex?: boolean, className?: string }) {
  return (
    <div className={`flex flex-col border-b border-white/5 last:border-0 ${flex ? 'flex-1 overflow-hidden' : ''} ${className}`}>
      <div className="h-8 flex items-center px-4 bg-white/[0.02]">
        <span className="text-[10px] font-bold text-zinc-500 tracking-widest">{title}</span>
      </div>
      <div className={`p-4 ${flex || className.includes('flex') ? 'flex-1 overflow-hidden' : ''}`}>
        {children}
      </div>
    </div>
  );
}

function BottomPanel() {
  const [height, setHeight] = useState(200);
  const minH = 36; // collapse to just the tab headers
  const maxH = 500;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setHeight(Math.max(minH, Math.min(maxH, startH + delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-full h-[5px] cursor-row-resize bg-white/5 hover:bg-blue-500/40 transition-colors shrink-0"
      />
      <div className="bg-[#0a0a0a] flex shrink-0 overflow-hidden" style={{ height }}>
        <div className="w-1/5 border-r border-white/5 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">PERFORMANCE</span>
          </div>
          <PerformanceWidget />
        </div>

        <div className="w-1/5 border-r border-white/5 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">OPEN POSITIONS</span>
          </div>
          <div className="flex-1 overflow-hidden">
             <OpenPositionsWidget />
          </div>
        </div>

        <div className="w-1/5 border-r border-white/5 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">RECENT TRADES</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <RecentTradesWidget />
          </div>
        </div>

        <div className="w-1/5 border-r border-white/5 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">RISK MANAGEMENT</span>
          </div>
          <RiskStatusWidget />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">SIGNAL HISTORY</span>
          </div>
          <div className="flex-1 overflow-hidden">
             <SignalHistory />
          </div>
        </div>
      </div>
    </>
  );
}
