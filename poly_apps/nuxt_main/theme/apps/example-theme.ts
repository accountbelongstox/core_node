import { BaseTheme, type BaseThemeConfig } from '../base-theme.config';

const exampleThemeConfig: Partial<BaseThemeConfig> = {
  name: 'Example Theme',
  version: '1.0.0',

  colors: {
    primary: '#4361ee',
    secondary: '#805dca',
    success: '#00ab55',
    warning: '#e7515a',
    danger: '#e7515a',
    info: '#2196f3',
    dark: '#3b3f5c',
    light: '#f1f2f3',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #4361ee 0%, #3182ce 100%)',
    secondary: 'linear-gradient(135deg, #805dca 0%, #667eea 100%)',
    success: 'linear-gradient(135deg, #00ab55 0%, #10b981 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    danger: 'linear-gradient(135deg, #e7515a 0%, #dc2626 100%)',
    info: 'linear-gradient(135deg, #2196f3 0%, #3b82f6 100%)',
  },

  customStyles: {
    demoCardBorder: '2px dashed #4361ee',
    exampleHighlight: '#fef3c7',
  },
};

export const exampleTheme = new BaseTheme(exampleThemeConfig);

export default exampleTheme;
