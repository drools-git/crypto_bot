"use client";

import React, { useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { OrderBook } from "@/components/OrderBook";
import { TradeTape } from "@/components/TradeTape";
import { NewsFeed } from "@/components/NewsFeed";
import { Activity, Settings } from "lucide-react";

export default function TerminalDashboard() {
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
            <span className="text-blue-500 cursor-pointer">Terminal</span>
            <span className="hover:text-zinc-200 cursor-pointer transition-colors">Backtest</span>
            <span className="hover:text-zinc-200 cursor-pointer transition-colors">Portfolios</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-zinc-400 font-mono">WS: DIRECT</span>
          </div>
          <Settings className="w-4 h-4 text-zinc-500 hover:text-zinc-300 cursor-pointer" />
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL */}
        <div className="w-64 border-r border-white/5 flex flex-col bg-[#0a0a0a] shrink-0">
          <PanelSection title="WATCHLIST">
            <div className="flex justify-between items-center py-1 cursor-pointer hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <div className="flex gap-2 items-center">
                <span className="font-mono text-xs font-bold text-zinc-200">BTC/USDT</span>
              </div>
              <span className="font-mono text-xs text-emerald-500">+2.4%</span>
            </div>
            <div className="flex justify-between items-center py-1 cursor-pointer hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <div className="flex gap-2 items-center">
                <span className="font-mono text-xs font-bold text-zinc-200">ETH/USDT</span>
              </div>
              <span className="font-mono text-xs text-rose-500">-1.2%</span>
            </div>
          </PanelSection>
          
          <PanelSection title="ACTIVE SIGNALS">
            <div className="text-xs text-zinc-500 font-mono py-2 flex items-center justify-center h-full opacity-50">
              No active signals
            </div>
          </PanelSection>
          
          <PanelSection title="MARKET INTELLIGENCE" flex>
            <NewsFeed />
          </PanelSection>
        </div>

        {/* CENTER PANEL */}
        <div className="flex-1 bg-[#000000] relative flex flex-col">
          <div className="absolute top-14 left-4 z-10 flex gap-4 pointer-events-none">
             <div className="bg-[#0a0a0a]/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded flex items-center gap-3 shadow-lg">
               <span className="font-mono text-lg font-bold text-zinc-100">BTC/USDT</span>
               <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">1H</span>
             </div>
          </div>
          <PriceChart symbol="BTC/USDT" />
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

      {/* BOTTOM PANEL - Resizable */}
      <BottomPanel />
    </div>
  );
}

function PanelSection({ title, children, flex = false }: { title: string, children: React.ReactNode, flex?: boolean }) {
  return (
    <div className={`flex flex-col border-b border-white/5 last:border-0 ${flex ? 'flex-1 overflow-hidden' : ''}`}>
      <div className="h-8 flex items-center px-4 bg-white/[0.02]">
        <span className="text-[10px] font-bold text-zinc-500 tracking-widest">{title}</span>
      </div>
      <div className={`p-4 ${flex ? 'flex-1 overflow-hidden' : ''}`}>
        {children}
      </div>
    </div>
  );
}

function BottomPanel() {
  const [height, setHeight] = useState(160);
  const minH = 36; // collapse to just the tab headers
  const maxH = 300;

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
        <div className="w-1/4 border-r border-white/5 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">PERFORMANCE</span>
          </div>
          <div className="p-4 flex flex-col gap-2 flex-1 justify-center overflow-hidden">
            <div className="flex justify-between items-end">
              <span className="text-xs text-zinc-500">Unrealized PNL</span>
              <span className="font-mono text-emerald-500">+$0.00</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-xs text-zinc-500">Realized PNL</span>
              <span className="font-mono text-emerald-500">+$0.00</span>
            </div>
            <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/5">
              <span className="text-xs text-zinc-500">Total Equity</span>
              <span className="font-mono text-zinc-200 font-bold">$100,000.00</span>
            </div>
          </div>
        </div>

        <div className="w-1/4 border-r border-white/5 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">OPEN POSITIONS</span>
          </div>
          <div className="p-4 text-xs text-zinc-600 font-mono flex items-center justify-center h-full opacity-50">
            No active positions
          </div>
        </div>

        <div className="w-1/4 border-r border-white/5 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">RECENT TRADES</span>
          </div>
          <div className="p-4 text-xs text-zinc-600 font-mono flex items-center justify-center h-full opacity-50">
            No execution history
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="h-8 border-b border-white/5 flex items-center px-4 bg-white/[0.01] shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest">SYSTEM LOGS</span>
          </div>
          <div className="p-3 text-[10px] text-zinc-500 font-mono flex flex-col gap-1.5 overflow-y-auto">
            <span className="text-emerald-500/70">[SYS] UI Terminal initialized successfully.</span>
            <span>[NET] Connecting to WSS Binance endpoint...</span>
            <span className="text-blue-400/70">[NET] Subscribed to btcusdt@depth20</span>
            <span className="text-blue-400/70">[NET] Subscribed to btcusdt@trade</span>
            <span className="text-blue-400/70">[NET] Subscribed to btcusdt@kline_1h</span>
            <span className="text-amber-500/70">[ENG] Strategy engine standby mode.</span>
          </div>
        </div>
      </div>
    </>
  );
}
