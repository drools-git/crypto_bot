"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries } from 'lightweight-charts';

interface PriceChartProps {
  symbol: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: 0, // Normal mode
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;

    let ws: WebSocket;

    const fetchData = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/market/klines?symbol=${symbol}&timeframe=1h&limit=200`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          candlestickSeries.setData(data);
          setLoading(false);
          
          // Connect WS after initial data
          const stream = symbol.toLowerCase().replace('/', '');
          ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}@kline_1h`);
          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.k) {
              const kline = message.k;
              candlestickSeries.update({
                time: Math.floor(kline.t / 1000) as any,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
              });
            }
          };
        }
      } catch (error) {
        console.error('Error fetching klines:', error);
      }
    };

    fetchData();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws) ws.close();
      chart.remove();
    };
  }, [symbol]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
          <p className="text-blue-500 text-sm animate-pulse font-mono">SYNCING TICKER...</p>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};
