"use client";
import React, { useState, useEffect } from "react";
import { Settings, Shield, Zap, TrendingUp, BarChart3, Layers, Sliders, Save, CheckCircle2 } from "lucide-react";

type Strategy = {
  strategy_id: string;
  strategy_name: string;
  version: string;
  description: string;
  enabled: boolean;
  weight: number;
  params: Record<string, any>;
};

export const StrategyManagerView = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchStrategies = async () => {
    try {
      const host = window.location.hostname || "localhost";
      const res = await fetch(`http://${host}:8000/api/v1/strategies/`);
      const data = await res.json();
      setStrategies(data);
    } catch (e) {
      console.error("Failed to fetch strategies", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const toggleStrategy = async (id: string, currentlyEnabled: boolean) => {
    setSaving(id);
    try {
      const host = window.location.hostname || "localhost";
      const action = currentlyEnabled ? "disable" : "enable";
      await fetch(`http://${host}:8000/api/v1/strategies/${id}/${action}`, { method: "POST" });
      await fetchStrategies();
    } catch (e) {
      console.error(`Failed to ${currentlyEnabled ? "disable" : "enable"} strategy`, e);
    } finally {
      setSaving(null);
    }
  };

  const updateWeight = async (id: string, weight: number) => {
    setSaving(id);
    try {
      const host = window.location.hostname || "localhost";
      await fetch(`http://${host}:8000/api/v1/strategies/${id}/weight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight })
      });
      // Update local state for immediate feedback
      setStrategies(prev => prev.map(s => s.strategy_id === id ? { ...s, weight } : s));
    } catch (e) {
      console.error("Failed to update weight", e);
      await fetchStrategies(); // rollback
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black/40">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-zinc-500 font-mono text-sm tracking-widest uppercase">Initializing Strategy Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden bg-[#050505] flex flex-col p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-3">
            <Sliders className="w-8 h-8 text-blue-500" />
            Consensus Strategy Manager
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Configure active algorithms and their influence on the final trading decisions.</p>
        </div>
        <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-xs font-bold text-blue-500 tracking-widest uppercase">Engine: Weighted Consensus v2.1</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar">
        {strategies.map((strat) => (
          <div 
            key={strat.strategy_id}
            className={`relative group bg-[#0a0a0a] border ${strat.enabled ? 'border-white/10' : 'border-white/5 opacity-60'} rounded-2xl p-6 transition-all duration-300 hover:border-blue-500/30 hover:bg-[#0d0d0d] shadow-2xl overflow-hidden`}
          >
            {/* Status indicators */}
            <div className="absolute top-0 right-0 p-4">
              {saving === strat.strategy_id ? (
                <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              ) : (
                strat.enabled && <CheckCircle2 className="w-5 h-5 text-emerald-500 shadow-sm" />
              )}
            </div>

            <div className="flex flex-col h-full space-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StrategyIcon id={strat.strategy_id} />
                  <h3 className="font-bold text-zinc-200 text-lg tracking-tight group-hover:text-white transition-colors">{strat.strategy_name}</h3>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2">{strat.description || "Institutional grade algorithmic logic for precision execution."}</p>
              </div>

              {/* Toggle and Weight Control */}
              <div className="space-y-4 bg-black/40 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Operational Status</span>
                  <button
                    onClick={() => toggleStrategy(strat.strategy_id, strat.enabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${strat.enabled ? 'bg-blue-600' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${strat.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Influence Weight</span>
                    <span className="text-xs font-mono font-bold text-blue-500">{strat.weight}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={strat.weight}
                    disabled={!strat.enabled}
                    onChange={(e) => updateWeight(strat.strategy_id, parseInt(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-30"
                  />
                  <div className="flex justify-between text-[8px] text-zinc-600 font-bold">
                    <span>MIN</span>
                    <span>NEUTRAL (50)</span>
                    <span>MAX</span>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-[9px] font-bold tracking-widest text-zinc-600 border-t border-white/5 pt-4">
                <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> v{strat.version}</span>
                <span className="flex items-center gap-1 uppercase">{strat.strategy_id.replace('_', ' ')} ENGINE</span>
              </div>
            </div>
            
            {/* Background pattern */}
            <div className="absolute -bottom-6 -right-6 opacity-[0.02] transform rotate-12 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <StrategyIcon id={strat.strategy_id} size={120} />
            </div>
          </div>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-6 shrink-0 mt-auto">
        <StatBox label="Active Engines" value={strategies.filter(s => s.enabled).length.toString()} icon={<Zap className="w-4 h-4" />} color="blue" />
        <StatBox label="Aggregated Weight" value={`${strategies.filter(s => s.enabled).reduce((acc, s) => acc + s.weight, 0)}%`} icon={<BarChart3 className="w-4 h-4" />} color="emerald" />
        <StatBox label="Risk Profile" value="Balanced" icon={<Shield className="w-4 h-4" />} color="amber" />
        <StatBox label="Last Optimization" value="Today, 14:22" icon={<TrendingUp className="w-4 h-4" />} color="zinc" />
      </div>
    </div>
  );
};

const StrategyIcon = ({ id, size = 20 }: { id: string, size?: number }) => {
  if (id.includes("trend")) return <TrendingUp style={{ width: size, height: size }} className="text-blue-500" />;
  if (id.includes("reversion")) return <BarChart3 style={{ width: size, height: size }} className="text-emerald-500" />;
  if (id.includes("breakout")) return <Zap style={{ width: size, height: size }} className="text-amber-500" />;
  if (id.includes("flow")) return <Layers style={{ width: size, height: size }} className="text-purple-500" />;
  if (id.includes("smart")) return <Shield style={{ width: size, height: size }} className="text-rose-500" />;
  return <Sliders style={{ width: size, height: size }} className="text-zinc-500" />;
};

const StatBox = ({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) => {
  const colorMap: Record<string, string> = {
    blue: "text-blue-500 bg-blue-500/5 border-blue-500/10",
    emerald: "text-emerald-500 bg-emerald-500/5 border-emerald-500/10",
    amber: "text-amber-500 bg-amber-500/5 border-amber-500/10",
    zinc: "text-zinc-400 bg-zinc-500/5 border-white/5",
  };

  return (
    <div className={`p-4 rounded-xl border ${colorMap[color] || colorMap.zinc} flex flex-col gap-1`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">{label}</span>
      </div>
      <span className="text-xl font-bold tracking-tight text-white">{value}</span>
    </div>
  );
};
