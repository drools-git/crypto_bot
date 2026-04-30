"use client";
import React, { useEffect, useState } from 'react';

export const NewsFeed = () => {
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const host = window.location.hostname || 'localhost';
        const res = await fetch(`http://${host}:8000/api/v1/news/latest?limit=15`);
        const data = await res.json();
        setNews(data);
      } catch(e) {
        console.error("Failed to fetch news");
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 120000);
    return () => clearInterval(interval);
  }, []);

  return (
     <div className="flex flex-col h-full overflow-y-auto pr-2 space-y-4">
        {news.length === 0 && <span className="text-zinc-500 text-[10px] font-mono">Loading market intelligence...</span>}
        {news.map((item, i) => (
          <div key={i} className="flex flex-col space-y-1 cursor-pointer group" onClick={() => window.open(item.url, '_blank')}>
            <span className="text-[11px] font-medium text-zinc-300 group-hover:text-blue-400 line-clamp-2 leading-tight transition-colors">
              {item.title}
            </span>
            <div className="flex justify-between text-[9px] text-zinc-500 uppercase font-mono">
              <span className="text-blue-500/70">{item.source}</span>
              <span>{new Date(item.published_at * 1000).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
     </div>
  );
};
