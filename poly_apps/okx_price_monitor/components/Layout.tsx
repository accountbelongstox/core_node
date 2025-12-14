import React from 'react';
import { PageRoute } from '../types';
import { Activity, BarChart2, Bell, Settings, Database, Server, Menu, X, ChevronUp, ChevronDown } from 'lucide-react';
import LogViewer from './LogViewer';

interface LayoutProps {
  children: React.ReactNode;
  activePage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  connected: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate, connected }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [logViewerOpen, setLogViewerOpen] = React.useState(true);
  const [logViewerHeight, setLogViewerHeight] = React.useState(300);

  const NavItem = ({ page, icon: Icon, label }: { page: PageRoute; icon: any; label: string }) => (
    <button
      onClick={() => {
        onNavigate(page);
        setSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
        activePage === page
          ? 'bg-app-accent/10 text-app-accent border-r-2 border-app-accent'
          : 'text-gray-400 hover:bg-app-surface hover:text-white'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-app-bg text-app-text font-sans">
      {/* Top Header */}
      <header className="h-14 flex-none border-b border-app-border bg-app-bg flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-1" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X /> : <Menu />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-app-accent flex items-center justify-center font-bold text-white">
              OKX
            </div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">Price Monitor <span className="text-xs font-normal text-app-muted border border-app-border px-1 rounded">v2.0</span></h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
             <span className={`w-2 h-2 rounded-full ${connected ? 'bg-app-up animate-pulse' : 'bg-app-down'}`}></span>
             <span className={connected ? 'text-app-up' : 'text-app-down'}>
               {connected ? 'RPC Connected' : 'Disconnected'}
             </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <nav className={`
          absolute inset-y-0 left-0 z-50 w-64 bg-app-bg border-r border-app-border transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="py-4 space-y-1">
            <div className="px-4 pb-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dashboards</div>
            <NavItem page="monitor" icon={Activity} label="Real-time Monitor" />
            <NavItem page="history" icon={BarChart2} label="History Stats" />
            <NavItem page="alerts" icon={Bell} label="Trading Alerts" />
            
            <div className="px-4 pt-6 pb-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</div>
            <NavItem page="config" icon={Settings} label="Configuration" />
            <NavItem page="stats" icon={Server} label="System Stats" />
          </div>
        </nav>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-app-bg relative flex flex-col">
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto h-full flex flex-col">
              {children}
            </div>
          </div>

          {/* Log Viewer Section */}
          <div
            className="border-t border-app-border bg-app-surface/30 transition-all duration-300 ease-in-out flex flex-col"
            style={{ height: logViewerOpen ? `${logViewerHeight}px` : '32px' }}
          >
            {/* Log Viewer Header/Toggle */}
            <div
              className="h-8 flex items-center justify-between px-4 bg-app-surface cursor-pointer hover:bg-app-border transition-colors"
              onClick={() => setLogViewerOpen(!logViewerOpen)}
            >
              <div className="flex items-center gap-2">
                {logViewerOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                <span className="text-sm font-semibold text-gray-400">System Logs</span>
              </div>
              <div className="flex items-center gap-2">
                {!logViewerOpen && (
                  <span className="text-xs text-gray-500">Click to expand</span>
                )}
              </div>
            </div>

            {/* Log Viewer Content */}
            {logViewerOpen && (
              <div className="flex-1 overflow-hidden">
                <LogViewer />
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar (System Info) - Hidden on small screens */}
        <aside className="hidden xl:block w-64 border-l border-app-border bg-app-surface/30 p-4 overflow-auto">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">System Status</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Service</span>
                <span className="text-green-400">Running</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Latency</span>
                <span>12ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Memory</span>
                <span>245 MB</span>
              </div>
            </div>
          </div>

          <div>
             <h3 className="text-sm font-semibold text-gray-400 mb-3">Quick Actions</h3>
             <div className="grid grid-cols-2 gap-2">
               <button className="bg-app-border hover:bg-white/10 py-2 rounded text-xs transition-colors">Clear Cache</button>
               <button className="bg-app-border hover:bg-white/10 py-2 rounded text-xs transition-colors">Export Logs</button>
             </div>
          </div>
        </aside>
      </div>

      {/* Bottom Footer */}
      <footer className="h-8 border-t border-app-border bg-app-surface/50 flex items-center justify-between px-4 text-[10px] text-gray-500">
        <div>© 2025 OKX Price Monitor System. All rights reserved.</div>
        <div>Mode: MONITOR | Port: 58888</div>
      </footer>
    </div>
  );
};