import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../App';
import { Icons } from '../constants';
import Logo from './Logo';
import LanguageSelector from './LanguageSelector';

const Header: React.FC = () => {
  const { lang, setLang, theme, setTheme, user, t } = useAppContext();
  const location = useLocation();

  const navItems = [
    { name: t.home || 'Home', path: '/', icon: <Icons.Cpu /> },
    { name: t.modelPricingTitle || 'Model Pricing', path: '/pricing', icon: <Icons.Zap /> },
    { name: t.subscribeTitle || 'Subscribe Center', path: '/subscribe', icon: <Icons.Shield /> },
    { name: t.docsTitle || 'Documentation', path: '/docs', icon: <Icons.Activity /> },
  ];

  return (
    <header className="sticky top-0 z-50 glass border-b dark:border-white/5 border-slate-200 backdrop-blur-2xl">
      <div className="max-w-[1700px] mx-auto px-6 sm:px-12 md:px-20">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Logo />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] transition-all font-bold text-sm ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'dark:text-slate-400 text-slate-600 hover:bg-blue-600/10 hover:text-blue-500'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-12 h-12 rounded-[1.5rem] bg-slate-500/5 flex items-center justify-center hover:bg-blue-600/15 transition-all text-blue-500 shadow-lg"
              title={t.themeToggle}
            >
              <Icons.Zap />
            </button>

            {/* Language Selector */}
            <LanguageSelector />

            {/* Login Button */}
            {!user && (
              <Link
                to="/"
                className="px-6 py-3 rounded-[1.5rem] bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 glow-button"
              >
                {t.signIn || 'Sign In'}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

