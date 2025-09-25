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
import '../config_app_wuy/app_config_app_wuy.dart';

/// Wuy App Theme Configuration
/// Contains all theme-related customizations for the Wuy app
class WuyAppThemeConfig {
  
  /// Get Wuy-specific theme customizations
  static Map<String, dynamic> getThemeCustomizations() {
    return {
      // Primary color scheme
      'primaryColor': const Color(0xFF2196F3), // Blue
      'primaryColorDark': const Color(0xFF1976D2),
      'primaryColorLight': const Color(0xFFBBDEFB),
      
      // Accent colors
      'accentColor': const Color(0xFFFF9800), // Orange
      'secondaryColor': const Color(0xFF4CAF50), // Green
      
      // Background colors
      'backgroundColor': const Color(0xFFFAFAFA),
      'surfaceColor': const Color(0xFFFFFFFF),
      'cardColor': const Color(0xFFFFFFFF),
      
      // Text colors
      'textPrimaryColor': const Color(0xFF212121),
      'textSecondaryColor': const Color(0xFF757575),
      'textHintColor': const Color(0xFF9E9E9E),
      
      // Error colors
      'errorColor': const Color(0xFFD32F2F),
      'warningColor': const Color(0xFFFF9800),
      'successColor': const Color(0xFF4CAF50),
      
      // App-specific colors
      'wuyPrimaryColor': const Color(0xFF2196F3),
      'wuySecondaryColor': const Color(0xFFFF9800),
      'wuyBackgroundColor': const Color(0xFFF5F5F5),
      
      // Font settings
      'fontFamily': 'SFProText',
      'fontSize': 16.0,
      
      // Border radius
      'borderRadius': 8.0,
      'cardBorderRadius': 12.0,
      'buttonBorderRadius': 8.0,
      
      // Spacing
      'defaultPadding': 16.0,
      'smallPadding': 8.0,
      'largePadding': 24.0,
      
      // Animation settings
      'animationDuration': AppConfigAppWuy.animationDurationMs,
      'enableAnimations': AppConfigAppWuy.enableAnimations,
    };
  }

  /// Get primary color
  static Color get primaryColor => const Color(0xFF2196F3);
  
  /// Get secondary color
  static Color get secondaryColor => const Color(0xFFFF9800);
  
  /// Get background color
  static Color get backgroundColor => const Color(0xFFFAFAFA);
  
  /// Get surface color
  static Color get surfaceColor => const Color(0xFFFFFFFF);
  
  /// Get error color
  static Color get errorColor => const Color(0xFFD32F2F);
  
  /// Get success color
  static Color get successColor => const Color(0xFF4CAF50);
  
  /// Get warning color
  static Color get warningColor => const Color(0xFFFF9800);
  
  /// Get text primary color
  static Color get textPrimaryColor => const Color(0xFF212121);
  
  /// Get text secondary color
  static Color get textSecondaryColor => const Color(0xFF757575);
  
  /// Get default border radius
  static double get defaultBorderRadius => 8.0;
  
  /// Get card border radius
  static double get cardBorderRadius => 12.0;
  
  /// Get button border radius
  static double get buttonBorderRadius => 8.0;
  
  /// Get default padding
  static double get defaultPadding => 16.0;
  
  /// Get small padding
  static double get smallPadding => 8.0;
  
  /// Get large padding
  static double get largePadding => 24.0;
  
  /// Check if animations are enabled
  static bool get animationsEnabled => AppConfigAppWuy.enableAnimations;
  
  /// Get animation duration in milliseconds
  static int get animationDurationMs => AppConfigAppWuy.animationDurationMs;
}
