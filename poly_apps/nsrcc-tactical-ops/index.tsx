import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, useLocation } from './context/AuthContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Golf from './pages/Golf';
import Bungalow from './pages/Bungalow';
import Social from './pages/Social';
import Dining from './pages/Dining';
import Settings from './pages/Settings';
import ShootingRange from './pages/ShootingRange';
import VIP from './pages/VIP';
import CustomerService from './pages/CustomerService';
import Login from './pages/Login';
import { PageRoutes } from './types';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isLoginPage = location.pathname === PageRoutes.LOGIN;
  
  return (
    <div className="min-h-screen bg-mil-base text-mil-base font-sans flex flex-col relative bg-grid-pattern transition-colors duration-300">
      {/* Global Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      
      {!isLoginPage && <Header />}
      
      {/* Updated to pt-safe-offset to handle notch area + header height */}
      <main className={`flex-grow ${!isLoginPage ? 'pt-safe-offset' : ''} relative z-10`}>
        {children}
      </main>

      {!isLoginPage && <BottomNav />}
    </div>
  );
};

const App = () => {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <HashRouter>
            <AppLayout>
              <Routes>
                <Route path={PageRoutes.LOGIN} element={<Login />} />
                <Route path={PageRoutes.HOME} element={<Home />} />
                <Route path={PageRoutes.GOLF} element={<Golf />} />
                <Route path={PageRoutes.BUNGALOW} element={<Bungalow />} />
                <Route path={PageRoutes.SOCIAL} element={<Social />} />
                <Route path={PageRoutes.DINING} element={<Dining />} />
                
                {/* Sub Pages / Independent Pages */}
                <Route path={PageRoutes.SETTINGS} element={<Settings />} />
                <Route path={PageRoutes.SHOOTING} element={<ShootingRange />} />
                <Route path={PageRoutes.VIP} element={<VIP />} />
                <Route path={PageRoutes.CUSTOMER_SERVICE} element={<CustomerService />} />
              </Routes>
            </AppLayout>
          </HashRouter>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);