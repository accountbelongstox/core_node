import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MonitorPage } from './pages/Monitor';
import { HistoryPage } from './pages/History';
import { AlertsPage } from './pages/Alerts';
import { ConfigPage } from './pages/Config';
import { StatsPage } from './pages/Stats';
import { PageRoute } from './types';
import { RPCClient } from './services/rpc';

const App: React.FC = () => {
  // Simple hash-based routing since React Router is not available or desired for minimal deps
  const [currentPage, setCurrentPage] = useState<PageRoute>('monitor');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Check connection on mount
    const checkConnection = async () => {
      try {
        await RPCClient.getStats();
        setConnected(true);
      } catch (e) {
        // Even if we fail, RPCClient now mocks data, but we can set this to false to indicate "Simulated Mode"
        // However, RPCClient.call swallows the error and returns mock data.
        // We can check if the response data "looks" real or check a flag if we added one.
        // For now, let's assume if it returns, we are "connected" to the data source (real or mock).
        // To strictly detect backend (use correct port 58888):
        fetch('http://localhost:58888/rpc/monitor.stats', { method: 'POST', body: JSON.stringify({route:'monitor.stats', id:'ping'}) })
           .then(res => setConnected(res.ok))
           .catch(() => setConnected(false));
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'monitor': return <MonitorPage />;
      case 'history': return <HistoryPage />;
      case 'alerts': return <AlertsPage onNavigate={setCurrentPage} />;
      case 'config': return <ConfigPage />;
      case 'stats': return <StatsPage />;
      default: return <MonitorPage />;
    }
  };

  return (
    <Layout 
      activePage={currentPage} 
      onNavigate={setCurrentPage}
      connected={connected}
    >
      {renderPage()}
    </Layout>
  );
};

export default App;