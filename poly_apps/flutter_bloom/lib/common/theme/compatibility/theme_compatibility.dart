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
