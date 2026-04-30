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

  useEffect(() => {
    const stream = symbol.toLowerCase().replace('/', '');
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}@trade`);
    
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
    return () => ws.close();
  }, [symbol]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-xs font-mono overflow-hidden">
      <div className="flex justify-between text-zinc-500 mb-2 px-2">
        <span>Price</span>
        <span>Amount</span>
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
