import React, { useEffect, useState } from 'react';
import { HttpClient } from '../services/http';
import { CoinSummary } from '../types';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const MonitorPage: React.FC = () => {
  const [summaries, setSummaries] = useState<CoinSummary[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24; // 4 rows of 6 cols on large screens

  const fetchData = async () => {
    try {
      const data = await HttpClient.getAllSummaries(297);
      // Sort by volume by default for better visualization
      const sorted = data.summaries.sort((a, b) => b.volume_24h - a.volume_24h);
      setSummaries(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // 2s refresh
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Reset to page 1 when filter changes
    setCurrentPage(1);
  }, [filter]);

  const filteredItems = summaries.filter(s => 
    s.coin.toLowerCase().includes(filter.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const formatPrice = (price: number) => {
    if (price < 1) return price.toFixed(6);
    if (price < 10) return price.toFixed(4);
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatVolume = (vol: number) => {
    if (vol > 1000000000) return (vol / 1000000000).toFixed(2) + 'B';
    if (vol > 1000000) return (vol / 1000000).toFixed(2) + 'M';
    if (vol > 1000) return (vol / 1000).toFixed(2) + 'K';
    return vol.toString();
  };

  if (loading && summaries.length === 0) {
    return <div className="flex items-center justify-center h-full text-app-muted">Loading market data...</div>;
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Real-time Monitor</h2>
          <p className="text-sm text-app-muted">Live prices for {summaries.length} assets</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
          <input 
            type="text" 
            placeholder="Search coins..." 
            className="pl-9 pr-4 py-2 bg-app-surface border border-app-border rounded-lg text-sm focus:outline-none focus:border-app-accent text-white w-64"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
          {paginatedItems.map((item) => {
            const isUp = item.price_change_15m >= 0;
            return (
              <div key={item.coin} className="bg-app-surface border border-app-border rounded-lg p-4 hover:border-gray-600 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-lg">{item.coin}</span>
                  <span className={`text-xs px-2 py-1 rounded ${isUp ? 'bg-green-900/30 text-app-up' : 'bg-red-900/30 text-app-down'}`}>
                    {isUp ? '+' : ''}{item.price_change_15m.toFixed(2)}%
                  </span>
                </div>
                
                <div className="text-xl font-mono font-medium mb-3">
                  ${formatPrice(item.current_price)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>
                    <div className="text-[10px] uppercase">Vol 24h</div>
                    <div className="text-gray-300">{formatVolume(item.volume_24h)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase">Range 24h</div>
                    <div className="text-gray-300">{formatPrice(item.price_24h_low)} - {formatPrice(item.price_24h_high)}</div>
                  </div>
                </div>

                <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden flex">
                  {/* Simple visual bar representing price position within 24h range */}
                  <div 
                    className={`h-full ${isUp ? 'bg-app-up' : 'bg-app-down'}`} 
                    style={{ 
                      width: `${Math.min(100, Math.max(0, ((item.current_price - item.price_24h_low) / (item.price_24h_high - item.price_24h_low || 1)) * 100))}%`,
                      opacity: 0.7
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-app-border pt-4 mt-auto shrink-0">
          <div className="text-xs text-gray-500">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} entries
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded bg-app-surface border border-app-border hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center px-4 bg-app-surface border border-app-border rounded text-sm text-gray-300">
              Page {currentPage} of {totalPages}
            </div>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded bg-app-surface border border-app-border hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
