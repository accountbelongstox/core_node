import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MonitorPage } from './pages/Monitor';
import { HistoryPage } from './pages/History';
import { AlertsPage } from './pages/Alerts';
import { ConfigPage } from './pages/Config';
import { StatsPage } from './pages/Stats';
import { PageRoute } from './types';
import { HttpClient } from './services/http';

const App: React.FC = () => {
  // Simple hash-based routing since React Router is not available or desired for minimal deps
  const [currentPage, setCurrentPage] = useState<PageRoute>('monitor');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Check connection on mount
    const checkConnection = async () => {
      try {
        setConnected(await HttpClient.isAvailable());
      } catch {
        setConnected(false);
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
