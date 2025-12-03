import React from 'react';
import { useStore } from '../store';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Users, User as UserIcon, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// 1. Layout Container
export const MobileLayout: React.FC<{ children: React.ReactNode, showNav?: boolean, className?: string }> = ({ 
  children, 
  showNav = true,
  className
}) => {
  const { theme } = useStore();
  return (
    <div className={cn(
      "min-h-screen w-full max-w-md mx-auto relative overflow-hidden flex flex-col transition-colors duration-300",
      theme === 'dark' ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800",
      className
    )}>
      {/* Background Gradient Orbs */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[50%] bg-blue-400/20 blur-[100px] rounded-full pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[50%] bg-purple-400/20 blur-[100px] rounded-full pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
      
      <div className="relative z-10 flex-1 flex flex-col h-full overflow-y-auto pb-20 no-scrollbar">
        {children}
      </div>

      {showNav && <BottomNav />}
    </div>
  );
};

// 2. Glass Cards
export const GlassCard: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className, onClick }) => {
  const { theme } = useStore();
  return (
    <div 
      onClick={onClick}
      className={cn(
        "rounded-2xl p-4 transition-all duration-300",
        theme === 'dark' ? "glass-panel-dark" : "glass-panel",
        "shadow-lg hover:shadow-xl",
        className
      )}
    >
      {children}
    </div>
  );
};

// 3. Primary Button
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost' }> = ({ 
  className, 
  variant = 'primary', 
  ...props 
}) => {
  const variants = {
    primary: "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-blue-500/30",
    danger: "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-red-500/30",
    ghost: "bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-current"
  };

  return (
    <button 
      className={cn(
        "w-full py-3.5 rounded-xl font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

// 4. Input Field
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => {
  return (
    <input 
      className={cn(
        "w-full px-4 py-3 rounded-xl outline-none transition-all",
        "bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-black/5 dark:border-white/10",
        "focus:ring-2 focus:ring-blue-400 focus:bg-white/80 dark:focus:bg-black/40",
        className
      )}
      {...props}
    />
  );
};

// 5. Navigation Bar
export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useStore();
  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <Link to={to} className="flex flex-col items-center justify-center flex-1 h-full gap-1">
      <div className={cn(
        "p-1.5 rounded-full transition-all duration-300",
        isActive(to) ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 translate-y-[-4px]" : "text-slate-400"
      )}>
        <Icon size={24} strokeWidth={isActive(to) ? 2.5 : 2} />
      </div>
      <span className={cn(
        "text-[10px] font-medium transition-colors",
        isActive(to) ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
      )}>
        {label}
      </span>
    </Link>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-[80px] z-50">
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-white/20 dark:border-white/5" />
      <div className="relative z-10 flex items-center justify-between h-full pb-4 px-6">
        <NavItem to="/map" icon={MapPin} label={t('tab.map')} />
        <NavItem to="/friends" icon={Users} label={t('tab.friends')} />
        <NavItem to="/me" icon={UserIcon} label={t('tab.me')} />
      </div>
    </div>
  );
};

// 6. Header
export const Header: React.FC<{ title: string, backTo?: string, action?: React.ReactNode }> = ({ title, backTo, action }) => {
  return (
    <div className="flex items-center justify-between px-5 py-4 z-20 relative">
      <div className="w-10">
        {backTo && (
          <Link to={backTo} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 inline-flex">
            <ChevronLeft size={24} />
          </Link>
        )}
      </div>
      <h1 className="text-lg font-bold">{title}</h1>
      <div className="w-10 flex justify-end">
        {action}
      </div>
    </div>
  );
};
