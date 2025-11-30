import { BaseTheme, type BaseThemeConfig } from '@/common/theme/base-theme.config';

const devThemeConfig: Partial<BaseThemeConfig> = {
  name: 'Dev Tools Theme',
  version: '1.0.0',

  colors: {
    primary: '#10b981',
    secondary: '#06b6d4',
    success: '#00ab55',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    dark: '#0f172a',
    light: '#f8fafc',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    secondary: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    success: 'linear-gradient(135deg, #00ab55 0%, #10b981 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  },

  customStyles: {
    codeBlockBg: '#1e293b',
    terminalBg: '#0f172a',
    syntaxHighlight: '#10b981',
  },
};

export const devTheme = new BaseTheme(devThemeConfig);

export default devTheme;
