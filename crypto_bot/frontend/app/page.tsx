"use client";

import React from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Activity, 
  PieChart, 
  BarChart3, 
  Settings, 
  Bell,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard,
  ShieldCheck,
  Zap
} from "lucide-react";
import { PriceChart } from "@/components/PriceChart";

export default function Home() {
  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <span className="font-bold text-xl tracking-tight">ANTIGRAVITY</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active />
          <NavItem icon={<Activity className="w-4 h-4" />} label="Market Watch" />
          <NavItem icon={<PieChart className="w-4 h-4" />} label="Portfolio" />
          <NavItem icon={<ShieldCheck className="w-4 h-4" />} label="Risk Manager" />
          <NavItem icon={<BarChart3 className="w-4 h-4" />} label="Backtesting" />
        </nav>

        <div className="p-4 mt-auto border-t border-white/5">
          <NavItem icon={<Settings className="w-4 h-4" />} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search markets, strategies..." 
              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/5 rounded-full transition-colors relative">
              <Bell className="w-5 h-5 text-zinc-400" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#0a0a0a]"></span>
            </button>
            <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-medium text-zinc-100">drools-git</p>
                <p className="text-[10px] text-zinc-500">Pro Trader</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border border-white/20"></div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 space-y-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">Overview</h2>
              <p className="text-zinc-500 text-sm mt-1">Real-time performance monitoring and strategy signals.</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors">
                1H
              </button>
              <button className="px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium transition-colors">
                1D
              </button>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors">
                1W
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              label="Total Equity" 
              value="$124,502.45" 
              change="+12.5%" 
              positive 
              icon={<Wallet className="w-5 h-5 text-blue-400" />} 
            />
            <StatCard 
              label="Realized PnL" 
              value="+$14,203.12" 
              change="+5.2%" 
              positive 
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} 
            />
            <StatCard 
              label="Open Positions" 
              value="8 Active" 
              change="-2.1%" 
              positive={false} 
              icon={<Activity className="w-5 h-5 text-amber-400" />} 
            />
            <StatCard 
              label="Bot Performance" 
              value="92.4%" 
              change="+0.8%" 
              positive 
              icon={<Zap className="w-5 h-5 text-purple-400" />} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart Area */}
            <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium">Equity Curve</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-medium text-zinc-500">Benchmark</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                  <span>LAST SYNC: 14:45:22</span>
                </div>
              </div>
              
              {/* Real TradingView chart */}
              <div className="flex-1 min-h-[400px] w-full rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent relative overflow-hidden group">
                <PriceChart symbol="BTC/USDT" />
              </div>
            </div>

            {/* Strategy Sidebar */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 flex flex-col gap-6">
              <h3 className="text-lg font-bold">Active Strategies</h3>
              <div className="space-y-4">
                <StrategyItem 
                  name="Trend Following V2" 
                  pair="BTC/USDT" 
                  profit="+4.2%" 
                  status="Running" 
                />
                <StrategyItem 
                  name="Mean Reversion" 
                  pair="ETH/USDT" 
                  profit="-0.8%" 
                  status="Running" 
                />
                <StrategyItem 
                  name="Volatility Breakout" 
                  pair="SOL/USDT" 
                  profit="+12.4%" 
                  status="Paused" 
                />
                <StrategyItem 
                  name="Grid Trader" 
                  pair="XRP/USDT" 
                  profit="+2.1%" 
                  status="Running" 
                />
              </div>
              <button className="w-full mt-auto py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all">
                Manage Strategies
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`
      flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200
      ${active 
        ? "bg-blue-600/10 text-blue-500 font-semibold" 
        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"}
    `}>
      {icon}
      <span className="text-sm">{label}</span>
      {active && <div className="ml-auto w-1 h-4 bg-blue-500 rounded-full"></div>}
    </div>
  );
}

function StatCard({ label, value, change, positive, icon }: { label: string, value: string, change: string, positive: boolean, icon: React.ReactNode }) {
  return (
    <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${positive ? "text-emerald-500" : "text-rose-500"}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <div>
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function StrategyItem({ name, pair, profit, status }: { name: string, pair: string, profit: string, status: "Running" | "Paused" }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:bg-white/5 transition-all">
      <div className="space-y-1">
        <p className="text-sm font-bold text-zinc-100">{name}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500">{pair}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === "Running" ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-500/10 text-zinc-500"}`}>
            {status}
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${profit.startsWith("+") ? "text-emerald-500" : "text-rose-500"}`}>
          {profit}
        </p>
        <p className="text-[10px] text-zinc-500">24h Profit</p>
      </div>
    </div>
  );
}
