import React, { useEffect, useState } from 'react';
import { RPCClient } from '../services/rpc';
import { CoinSummary } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export const HistoryPage: React.FC = () => {
  const [summaries, setSummaries] = useState<CoinSummary[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CoinSummary | null>(null);

  // Mock history data generator because real API only returns current summary
  // In a real app, we'd fetch history from a separate endpoint
  const [mockHistory, setMockHistory] = useState<any[]>([]);

  const fetchSummaries = async () => {
    try {
      const data = await RPCClient.getAllSummaries(50); // Top 50
      setSummaries(data.summaries);
      if (!selectedCoin && data.summaries.length > 0) {
        setSelectedCoin(data.summaries[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSummaries();
    const interval = setInterval(fetchSummaries, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCoin) {
      // Generate some dummy historical data based on current price
      const data = [];
      let price = selectedCoin.current_price;
      const now = Date.now();
      for (let i = 24; i >= 0; i--) {
        price = price * (1 + (Math.random() - 0.5) * 0.05);
        data.push({
          time: new Date(now - i * 3600 * 1000).getHours() + ':00',
          price: price,
          volume: Math.random() * selectedCoin.volume_24h / 24
        });
      }
      setMockHistory(data);
    }
  }, [selectedCoin]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* List Section */}
      <div className="lg:col-span-1 bg-app-surface border border-app-border rounded-lg flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-app-border">
          <h2 className="font-bold">Market Overview</h2>
          <p className="text-xs text-gray-500">Top 50 by Volume</p>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-app-bg text-gray-500 sticky top-0 z-10">
              <tr>
                <th className="p-3 font-medium">Coin</th>
                <th className="p-3 font-medium text-right">Price</th>
                <th className="p-3 font-medium text-right">24h Vol</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(coin => (
                <tr 
                  key={coin.coin} 
                  onClick={() => setSelectedCoin(coin)}
                  className={`border-b border-app-border hover:bg-white/5 cursor-pointer transition-colors ${selectedCoin?.coin === coin.coin ? 'bg-app-accent/10 border-l-2 border-l-app-accent' : ''}`}
                >
                  <td className="p-3 font-medium">{coin.coin}</td>
                  <td className="p-3 text-right font-mono text-gray-300">${coin.current_price.toFixed(2)}</td>
                  <td className="p-3 text-right text-gray-500">{(coin.volume_24h / 1000000).toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Section */}
      <div className="lg:col-span-2 flex flex-col gap-6 h-full overflow-auto">
        
        {/* Price Chart */}
        <div className="bg-app-surface border border-app-border rounded-lg p-6 flex-1 min-h-[300px]">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                {selectedCoin?.coin} <span className="text-sm font-normal text-gray-500">/ USDT</span>
              </h3>
              <div className="text-2xl font-mono text-app-up mt-1">
                ${selectedCoin?.current_price.toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-app-border rounded text-xs hover:bg-gray-700">1H</button>
              <button className="px-3 py-1 bg-app-accent text-white rounded text-xs">24H</button>
              <button className="px-3 py-1 bg-app-border rounded text-xs hover:bg-gray-700">7D</button>
            </div>
          </div>
          
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockHistory}>
                <XAxis dataKey="time" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="#555" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toFixed(0)}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f1f23', border: 'none', borderRadius: '4px' }}
                  itemStyle={{ color: '#e0e0e0' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                />
                <Line type="monotone" dataKey="price" stroke="#00ff88" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume Chart */}
        <div className="bg-app-surface border border-app-border rounded-lg p-6 h-[250px]">
          <h3 className="font-bold mb-4 text-sm text-gray-400">Volume (24h)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockHistory}>
               <XAxis dataKey="time" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
               <Tooltip 
                 cursor={{fill: 'rgba(255,255,255,0.05)'}}
                 contentStyle={{ backgroundColor: '#1f1f23', border: 'none', borderRadius: '4px' }}
               />
               <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
};