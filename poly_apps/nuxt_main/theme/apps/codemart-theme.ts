import { BaseTheme, type BaseThemeConfig } from '../base-theme.config';

const codemartThemeConfig: Partial<BaseThemeConfig> = {
  name: 'CodeMart Theme',
  version: '1.0.0',

  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    success: '#00ab55',
    warning: '#f59e0b',
    danger: '#e7515a',
    info: '#2196f3',
    dark: '#1e293b',
    light: '#f8fafc',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    secondary: 'linear-gradient(135deg, #805dca 0%, #667eea 100%)',
    success: 'linear-gradient(135deg, #00ab55 0%, #10b981 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    danger: 'linear-gradient(135deg, #e7515a 0%, #dc2626 100%)',
    info: 'linear-gradient(135deg, #2196f3 0%, #3b82f6 100%)',
  },

  customStyles: {
    sidebarGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    cardShadow: '0 4px 20px rgba(102, 126, 234, 0.15)',
    hoverShadow: '0 8px 30px rgba(102, 126, 234, 0.25)',
  },
};

export const codemartTheme = new BaseTheme(codemartThemeConfig);

export default codemartTheme;
