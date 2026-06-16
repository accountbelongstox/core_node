'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * StatsCard Props
 */
export interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label?: string;
  };
  subtitle?: string;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * StatsCard Component
 *
 * Display statistics with icon, trend, and optional click action
 */
export function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBgColor = 'bg-blue-100',
  trend,
  subtitle,
  loading = false,
  className = '',
  onClick
}: StatsCardProps) {
  const isPositiveTrend = trend?.direction === 'up';
  const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown;
  const trendColor = isPositiveTrend ? 'text-green-600' : 'text-red-600';

  return (
    <div
      className={`
        bg-white rounded-lg shadow p-6 transition-all
        ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>

          {loading ? (
            <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          )}

          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}

          {trend && !loading && (
            <div className="flex items-center gap-1 mt-2">
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
              <span className={`text-sm font-medium ${trendColor}`}>
                {trend.value}%
              </span>
              {trend.label && (
                <span className="text-sm text-gray-500">{trend.label}</span>
              )}
            </div>
          )}
        </div>

        {Icon && (
          <div className={`${iconBgColor} p-3 rounded-full`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StatsGrid Component
 *
 * Grid layout for multiple StatsCards
 */
export interface StatsGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatsGrid({
  children,
  columns = 4,
  gap = 'md',
  className = ''
}: StatsGridProps) {
  const gapClass = {
    sm: 'gap-3',
    md: 'gap-6',
    lg: 'gap-8'
  }[gap];

  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }[columns];

  return (
    <div className={`grid ${colsClass} ${gapClass} ${className}`}>
      {children}
    </div>
  );
}
