import React from 'react';
import { NavLink } from '../context/AuthContext';
import { Home, FlagTriangleRight, Users, Tent, UtensilsCrossed } from 'lucide-react';
import { PageRoutes } from '../types';
import { useLanguage } from '../context/LanguageContext';

const BottomNav: React.FC = () => {
  const { t } = useLanguage();

  const navItems = [
    { label: t.nav.home, path: PageRoutes.HOME, icon: Home },
    { label: t.nav.golf, path: PageRoutes.GOLF, icon: FlagTriangleRight },
    { label: t.nav.social, path: PageRoutes.SOCIAL, icon: Users },
    { label: t.nav.stay, path: PageRoutes.BUNGALOW, icon: Tent },
    { label: t.nav.dining, path: PageRoutes.DINING, icon: UtensilsCrossed },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-mil-base border-t border-slate-700 z-50 pb-safe transition-colors duration-300">
      <div className="flex justify-around items-center h-full px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }: { isActive: boolean }) => `
              flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200
              ${isActive ? 'text-tac-orange' : 'text-slate-500 hover:text-mil-base'}
            `}
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                <div className={`p-1 rounded-md ${isActive ? 'bg-tac-orange/10 border border-tac-orange/20' : ''}`}>
                  <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-mono tracking-wider font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;