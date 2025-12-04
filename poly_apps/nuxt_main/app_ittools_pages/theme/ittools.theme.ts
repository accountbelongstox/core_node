import { BaseTheme, type BaseThemeConfig } from '../../theme/base-theme.config';
import { itToolsThemeColors } from './colors';

export interface ItToolsThemeConfig extends BaseThemeConfig {
    glass: {
        opacity: {
            base: number;
            strong: number;
            light: number;
        };
        blur: {
            base: string;
            strong: string;
        };
        border: {
            base: string;
            strong: string;
        };
    };
}

export const itToolsThemeConfig: ItToolsThemeConfig = {
    name: 'IT Tools Holographic',
    version: '1.0.0',
    locale: 'en',
    theme: 'light',
    menu: 'vertical',
    layout: 'full',
    rtlClass: 'ltr',
    animation: 'fade',
    navbar: 'navbar-sticky',
    semidark: false,

    colors: {
        primary: itToolsThemeColors.primary[500],
        secondary: itToolsThemeColors.secondary[500],
        success: itToolsThemeColors.status.success,
        warning: itToolsThemeColors.status.warning,
        danger: itToolsThemeColors.status.error,
        info: itToolsThemeColors.status.info,
        dark: itToolsThemeColors.neutral[800],
        light: itToolsThemeColors.neutral[50],
    },

    gradients: {
        primary: `linear-gradient(135deg, ${itToolsThemeColors.primary[500]} 0%, ${itToolsThemeColors.secondary[500]} 100%)`,
        secondary: `linear-gradient(135deg, ${itToolsThemeColors.secondary[500]} 0%, ${itToolsThemeColors.secondary[600]} 100%)`,
        success: `linear-gradient(135deg, ${itToolsThemeColors.status.success} 0%, #16a34a 100%)`,
        warning: `linear-gradient(135deg, ${itToolsThemeColors.status.warning} 0%, #d97706 100%)`,
        danger: `linear-gradient(135deg, ${itToolsThemeColors.status.error} 0%, #dc2626 100%)`,
        info: `linear-gradient(135deg, ${itToolsThemeColors.status.info} 0%, #2563eb 100%)`,
    },

    shadows: {
        sm: '0 2px 8px rgba(99, 102, 241, 0.06)',
        md: '0 4px 16px rgba(99, 102, 241, 0.08)',
        lg: '0 8px 32px rgba(99, 102, 241, 0.1)',
        xl: '0 16px 48px rgba(99, 102, 241, 0.12)',
    },

    spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
    },

    typography: {
        fontFamily: '"Inter", "Nunito", sans-serif',
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
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        full: '9999px',
    },

    glass: {
        opacity: {
            base: 0.65,
            strong: 0.85,
            light: 0.45,
        },
        blur: {
            base: '16px',
            strong: '24px',
        },
        border: {
            base: 'rgba(255, 255, 255, 0.5)',
            strong: 'rgba(255, 255, 255, 0.7)',
        },
    },
};

export class ItToolsTheme extends BaseTheme {
    protected config: ItToolsThemeConfig;

    constructor(config?: Partial<ItToolsThemeConfig>) {
        super(config);
        this.config = {
            ...itToolsThemeConfig,
            ...config,
        };
    }

    toCSSVariables(): Record<string, string> {
        const vars = super.toCSSVariables();

        // Add glass specific variables
        vars['--glass-bg'] = `rgba(255, 255, 255, ${this.config.glass.opacity.base})`;
        vars['--glass-bg-strong'] = `rgba(255, 255, 255, ${this.config.glass.opacity.strong})`;
        vars['--glass-bg-light'] = `rgba(255, 255, 255, ${this.config.glass.opacity.light})`;
        vars['--glass-blur'] = this.config.glass.blur.base;
        vars['--glass-blur-strong'] = this.config.glass.blur.strong;
        vars['--glass-border'] = this.config.glass.border.base;
        vars['--glass-border-strong'] = this.config.glass.border.strong;

        return vars;
    }
}

export const theme = new ItToolsTheme();
