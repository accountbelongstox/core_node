import { BaseTheme, type BaseThemeConfig } from '../base-theme.config';

const adminThemeConfig: Partial<BaseThemeConfig> = {
  name: 'Admin Theme',
  version: '1.0.0',

  colors: {
    primary: '#dc2626',
    secondary: '#7c3aed',
    success: '#00ab55',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    dark: '#1e293b',
    light: '#f8fafc',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    secondary: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    success: 'linear-gradient(135deg, #00ab55 0%, #10b981 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  },

  customStyles: {
    dangerZoneBg: '#fef2f2',
    dangerZoneBorder: '#fca5a5',
    adminBadge: 'linear-gradient(135deg, #dc2626 0%, #7c3aed 100%)',
  },
};

export const adminTheme = new BaseTheme(adminThemeConfig);

export default adminTheme;
