import React from 'react';
import { useStore } from '../store';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Users, User as UserIcon, ChevronLeft, Home, Sparkles, Plus, ShoppingBag } from 'lucide-react';
import { clsx } from 'clsx';

// 1. Layout Container
export const MobileLayout: React.FC<{ children: React.ReactNode, showNav?: boolean, className?: string, style?: React.CSSProperties }> = ({ 
  children, 
  showNav = true,
  className,
  style
}) => {
  return (
    <div className={clsx("mobile-layout", className)} style={style}>
      {/* Background Gradient Orbs via CSS */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      
      <div className="content-scroll">
        {children}
      </div>

      {showNav && <BottomNav />}
    </div>
  );
};

// 2. Glass Cards
export const GlassCard: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void, style?: React.CSSProperties }> = ({ children, className, onClick, style }) => {
  return (
    <div 
      onClick={onClick}
      className={clsx("glass-card", className)}
      style={style}
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
  return (
    <button 
      className={clsx(
        "btn",
        variant === 'primary' && "btn-primary",
        variant === 'danger' && "btn-danger",
        variant === 'ghost' && "btn-ghost",
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
      className={clsx("input-field", className)}
      {...props}
    />
  );
};

// 5. Floating Navigation Bar
export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useStore();
  const isActive = (path: string) => location.pathname === path;

  // Regular Nav Item
  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <Link to={to} className={clsx("nav-item", isActive(to) && "active")}>
      <Icon size={24} strokeWidth={isActive(to) ? 2.5 : 2} />
      <span className="nav-label">{label}</span>
    </Link>
  );

  return (
    <div className="floating-nav-container">
      <div className="floating-nav">
        {/* Left Side */}
        <NavItem to="/map" icon={Home} label={t('tab.home')} />
        <NavItem to="/friends" icon={Users} label={t('tab.friends')} />

        {/* Center Action Button */}
        <Link to="/friends/add" className="nav-center-btn">
          <Plus size={28} strokeWidth={2.5} />
        </Link>

        {/* Right Side */}
        <NavItem to="/shop" icon={ShoppingBag} label={t('tab.shop')} />
        <NavItem to="/me" icon={UserIcon} label={t('tab.me')} />
      </div>
    </div>
  );
};

// 6. Header
export const Header: React.FC<{ title: string, backTo?: string, action?: React.ReactNode }> = ({ title, backTo, action }) => {
  return (
    <div className="app-header">
      <div style={{ width: 40 }}>
        {backTo && (
          <Link to={backTo} className="back-btn">
            <ChevronLeft size={24} />
          </Link>
        )}
      </div>
      <h1 className="header-title">{title}</h1>
      <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
        {action}
      </div>
    </div>
  );
};