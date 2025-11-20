// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  dark: string;
  light: string;
}

export interface ThemeGradients {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  fontWeight: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface ThemeBorderRadius {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface BaseThemeConfig {
  name: string;
  version: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  menu: 'vertical' | 'collapsible-vertical' | 'horizontal';
  layout: 'full' | 'boxed-layout';
  rtlClass: 'rtl' | 'ltr';
  animation: string;
  navbar: 'navbar-sticky' | 'navbar-floating' | 'navbar-static';
  semidark: boolean;

  colors: ThemeColors;
  gradients: ThemeGradients;
  shadows: ThemeShadows;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  borderRadius: ThemeBorderRadius;

  customStyles?: Record<string, any>;
}

export const baseThemeConfig: BaseThemeConfig = {
  name: 'Base Theme',
  version: '1.0.0',
  locale: 'en',
  theme: 'light',
  menu: 'vertical',
  layout: 'full',
  rtlClass: 'ltr',
  animation: '',
  navbar: 'navbar-sticky',
  semidark: false,

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

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },

  typography: {
    fontFamily: '"Nunito", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      xxl: '1.5rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
};

export class BaseTheme {
  protected config: BaseThemeConfig;

  constructor(config?: Partial<BaseThemeConfig>) {
    this.config = {
      ...baseThemeConfig,
      ...config,
    };
  }

  getConfig(): BaseThemeConfig {
    return this.config;
  }

  getColor(colorKey: keyof ThemeColors): string {
    return this.config.colors[colorKey];
  }

  getGradient(gradientKey: keyof ThemeGradients): string {
    return this.config.gradients[gradientKey];
  }

  getShadow(shadowKey: keyof ThemeShadows): string {
    return this.config.shadows[shadowKey];
  }

  getSpacing(spacingKey: keyof ThemeSpacing): string {
    return this.config.spacing[spacingKey];
  }

  getBorderRadius(radiusKey: keyof ThemeBorderRadius): string {
    return this.config.borderRadius[radiusKey];
  }

  extend(overrides: Partial<BaseThemeConfig>): BaseTheme {
    return new BaseTheme({
      ...this.config,
      ...overrides,
      colors: {
        ...this.config.colors,
        ...overrides.colors,
      },
      gradients: {
        ...this.config.gradients,
        ...overrides.gradients,
      },
      shadows: {
        ...this.config.shadows,
        ...overrides.shadows,
      },
      spacing: {
        ...this.config.spacing,
        ...overrides.spacing,
      },
      typography: {
        ...this.config.typography,
        ...overrides.typography,
      },
      borderRadius: {
        ...this.config.borderRadius,
        ...overrides.borderRadius,
      },
    });
  }

  toCSSVariables(): Record<string, string> {
    const cssVars: Record<string, string> = {};
    const config = this.config;

    Object.entries(config.colors).forEach(([key, value]) => {
      cssVars[`--color-${key}`] = value;
    });

    Object.entries(config.shadows).forEach(([key, value]) => {
      cssVars[`--shadow-${key}`] = value;
    });

    Object.entries(config.spacing).forEach(([key, value]) => {
      cssVars[`--spacing-${key}`] = value;
    });

    Object.entries(config.borderRadius).forEach(([key, value]) => {
      cssVars[`--radius-${key}`] = value;
    });

    return cssVars;
  }

  applyCSSVariables(element: HTMLElement = document.documentElement): void {
    const cssVars = this.toCSSVariables();
    Object.entries(cssVars).forEach(([key, value]) => {
      element.style.setProperty(key, value);
    });
  }
}

export function createTheme(config?: Partial<BaseThemeConfig>): BaseTheme {
  return new BaseTheme(config);
}

export default BaseTheme;
