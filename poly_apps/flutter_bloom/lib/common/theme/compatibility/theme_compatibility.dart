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

import 'package:flutter/material.dart';
import '../theme_manager.dart';

/// Backward compatibility functions for old theme system
/// These functions maintain the same API as the old theme files

/// Get app light theme (backward compatibility for old getAppLightTheme function)
ThemeData getAppLightTheme() {
  return ThemeManager.instance.getLightTheme();
}

/// Get app dark theme (backward compatibility for old getAppDarkTheme function)
ThemeData getAppDarkTheme() {
  return ThemeManager.instance.getDarkTheme();
}

/// Get app light theme with extensions (recommended for new usage)
ThemeData getAppLightThemeWithExtensions() {
  return ThemeManager.instance.getLightThemeWithExtensions();
}

/// Get app dark theme with extensions (recommended for new usage)
ThemeData getAppDarkThemeWithExtensions() {
  return ThemeManager.instance.getDarkThemeWithExtensions();
}
