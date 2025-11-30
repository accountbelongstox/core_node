import { BaseTheme, type BaseThemeConfig } from '@/common/theme/base-theme.config';

const dashboardThemeConfig: Partial<BaseThemeConfig> = {
  name: 'Dashboard Theme',
  version: '1.0.0',

  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    dark: '#1e293b',
    light: '#f8fafc',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    secondary: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    info: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  },

  customStyles: {
    chartPrimary: '#3b82f6',
    chartSecondary: '#8b5cf6',
    chartSuccess: '#10b981',
    chartWarning: '#f59e0b',
    chartDanger: '#ef4444',
    widgetShadow: '0 4px 20px rgba(59, 130, 246, 0.15)',
  },
};

export const dashboardTheme = new BaseTheme(dashboardThemeConfig);

export default dashboardTheme;
