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

import { darken, lighten } from '../color/color.models';
import { defineThemes } from '../theme/theme.models';
import { appThemes } from '../theme/themes';

function createState({
  textColor,
  backgroundColor,
  hoverBackground,
  hoveredTextColor = textColor,
  pressedBackground,
  pressedTextColor = textColor,
}: {
  textColor: string
  backgroundColor: string
  hoverBackground: string
  hoveredTextColor?: string
  pressedBackground: string
  pressedTextColor?: string
}) {
  return {
    textColor,
    backgroundColor,
    hover: { textColor: hoveredTextColor, backgroundColor: hoverBackground },
    pressed: { textColor: pressedTextColor, backgroundColor: pressedBackground },
  };
}

function createTheme({ style }: { style: 'light' | 'dark' }) {
  const theme = appThemes[style];

  return {
    size: {
      small: {
        width: '28px',
        fontSize: '12px',
      },
      medium: {
        width: '34px',
        fontSize: '14px',
      },
      large: {
        width: '40px',
        fontSize: '16px',
      },
    },

    basic: {
      default: createState({
        textColor: theme.text.baseColor,
        backgroundColor: theme.default.color,
        hoverBackground: theme.default.colorHover,
        pressedBackground: theme.default.colorPressed,
      }),
      primary: createState({
        textColor: theme.primary.color,
        backgroundColor: theme.primary.colorFaded,
        hoverBackground: lighten(theme.primary.colorFaded, 30),
        pressedBackground: darken(theme.primary.colorFaded, 30),
      }),
      warning: createState({
        textColor: theme.warning.color,
        backgroundColor: theme.warning.colorFaded,
        hoverBackground: lighten(theme.warning.colorFaded, 30),
        pressedBackground: darken(theme.warning.colorFaded, 30),
      }),
      error: createState({
        textColor: theme.error.color,
        backgroundColor: theme.error.colorFaded,
        hoverBackground: lighten(theme.error.colorFaded, 30),
        pressedBackground: darken(theme.error.colorFaded, 30),
      }),
    },
    text: {
      default: createState({
        textColor: theme.text.baseColor,
        backgroundColor: 'transparent',
        hoverBackground: theme.default.colorHover,
        pressedBackground: theme.default.colorPressed,
      }),
      primary: createState({
        textColor: theme.primary.color,
        backgroundColor: 'transparent',
        hoverBackground: theme.primary.colorFaded,
        pressedBackground: darken(theme.primary.colorFaded, 30),
      }),
      warning: createState({
        textColor: darken(theme.warning.color, 20),
        backgroundColor: 'transparent',
        hoverBackground: theme.warning.colorFaded,
        pressedBackground: darken(theme.warning.colorFaded, 30),
      }),
      error: createState({
        textColor: darken(theme.error.color, 20),
        backgroundColor: 'transparent',
        hoverBackground: theme.error.colorFaded,
        pressedBackground: darken(theme.error.colorFaded, 30),
      }),
    },
  };
}

export const { useTheme } = defineThemes({
  dark: createTheme({ style: 'dark' }),
  light: createTheme({ style: 'light' }),
});
