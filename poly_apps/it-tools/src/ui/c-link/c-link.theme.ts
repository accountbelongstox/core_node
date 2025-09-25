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

import { defineThemes } from '../theme/theme.models';
import { appThemes } from '../theme/themes';

export const { useTheme } = defineThemes({
  dark: {
    default: {
      textColor: appThemes.dark.primary.color,

      hover: {
        textColor: appThemes.dark.primary.colorHover,
      },

      pressed: {
        textColor: appThemes.dark.primary.colorPressed,
      },

      outline: {
        color: appThemes.dark.primary.color,
      },
    },
  },
  light: {
    default: {
      textColor: appThemes.light.primary.color,

      hover: {
        textColor: appThemes.light.primary.colorHover,
      },

      pressed: {
        textColor: appThemes.light.primary.colorPressed,
      },

      outline: {
        color: appThemes.light.primary.color,
      },
    },
  },
});
