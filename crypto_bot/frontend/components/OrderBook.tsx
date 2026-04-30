"use client";
import React, { useEffect, useState } from 'react';

export const OrderBook = ({ symbol }: { symbol: string }) => {
  const [bids, setBids] = useState<[string, string][]>([]);
  const [asks, setAsks] = useState<[string, string][]>([]);

  useEffect(() => {
    const stream = symbol.toLowerCase().replace('/', '');
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}@depth20@100ms`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.bids && data.asks) {
        setBids(data.bids.slice(0, 12));
        setAsks(data.asks.slice(0, 12).reverse());
      }
    };
    
    return () => ws.close();
  }, [symbol]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-xs font-mono overflow-hidden">
      <div className="flex justify-between text-zinc-500 mb-2 px-2">
        <span>Price</span>
        <span>Amount</span>
      </div>
      <div className="flex-1 flex flex-col justify-end px-2 space-y-[1px]">
        {asks.map((ask, i) => (
          <div key={i} className="flex justify-between text-rose-500 relative group cursor-pointer hover:bg-white/5">
            <span className="z-10">{parseFloat(ask[0]).toFixed(2)}</span>
            <span className="z-10 text-zinc-300">{parseFloat(ask[1]).toFixed(4)}</span>
            <div className="absolute right-0 top-0 h-full bg-rose-500/10" style={{ width: `${Math.random() * 80 + 20}%` }}></div>
          </div>
        ))}
      </div>
      <div className="py-2 px-2 border-y border-white/5 my-1 flex justify-between items-center bg-white/[0.02]">
        <span className="text-lg font-bold text-emerald-500">
          {asks.length > 0 ? parseFloat(asks[asks.length-1][0]).toFixed(2) : "---"}
        </span>
        <span className="text-[10px] text-zinc-500 uppercase">
          Spread: {asks.length > 0 && bids.length > 0 ? (parseFloat(asks[asks.length-1][0]) - parseFloat(bids[0][0])).toFixed(2) : "---"}
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-start px-2 space-y-[1px]">
        {bids.map((bid, i) => (
          <div key={i} className="flex justify-between text-emerald-500 relative group cursor-pointer hover:bg-white/5">
            <span className="z-10">{parseFloat(bid[0]).toFixed(2)}</span>
            <span className="z-10 text-zinc-300">{parseFloat(bid[1]).toFixed(4)}</span>
            <div className="absolute right-0 top-0 h-full bg-emerald-500/10" style={{ width: `${Math.random() * 80 + 20}%` }}></div>
          </div>
        ))}
      </div>
    </div>
  );
};
