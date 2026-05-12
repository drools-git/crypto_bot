"use client";
import React, { useEffect, useState } from 'react';

interface Trade {
  id: number;
  price: number;
  qty: number;
  isMaker: boolean;
  time: number;
}

export const TradeTape = ({ symbol }: { symbol: string }) => {
  const [trades, setTrades] = useState<Trade[]>([]);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      const stream = symbol.toLowerCase().replace('/', '');
      setStatus('connecting');
      // Use port 443 (standard HTTPS) to bypass restrictive firewalls
      ws = new WebSocket(`wss://stream.binance.com/ws/${stream}@trade`);
      
      ws.onopen = () => setStatus('connected');
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setTrades(prev => {
          const newTrades = [{
            id: data.t,
            price: parseFloat(data.p),
            qty: parseFloat(data.q),
            isMaker: data.m,
            time: data.T
          }, ...prev];
          return newTrades.slice(0, 30);
        });
      };

      ws.onerror = () => setStatus('error');

      ws.onclose = () => {
        setStatus('connecting');
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    
    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, [symbol]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-xs font-mono overflow-hidden">
      <div className="flex justify-between text-zinc-500 mb-2 px-2">
        <span>Price</span>
        <div className="flex items-center gap-2">
          {status === 'connecting' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
          {status === 'error' && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
          {status === 'connected' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          <span>Amount</span>
        </div>
        <span>Time</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {trades.map((t) => {
          const date = new Date(t.time);
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
          
          // isMaker = true means buyer was maker -> sell trade -> Red
          const colorClass = t.isMaker ? "text-rose-500" : "text-emerald-500";
          
          return (
            <div key={t.id} className="flex justify-between cursor-pointer hover:bg-white/5">
              <span className={colorClass}>{t.price.toFixed(2)}</span>
              <span className="text-zinc-300">{t.qty.toFixed(4)}</span>
              <span className="text-zinc-500">{timeStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
