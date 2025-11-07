/// Centralized theme system for Flutter Bloom
/// Provides consistent theming across all apps
library;

import 'package:flutter/material.dart';

class AppTheme {
  // Primary Colors
  static const Color primaryGreen = Color(0xFF4CAF50);
  static const Color secondaryGreen = Color(0xFF66BB6A);
  static const Color accentGreen = Color(0xFF81C784);
  static const Color darkGreen = Color(0xFF388E3C);
  static const Color lightGreen = Color(0xFFC8E6C9);

  // Backwards compatibility aliases
  static const Color primaryColor = primaryGreen;
  static const Color accentColor = accentGreen;
  static const Color secondaryColor = secondaryGreen;

  // Social Colors
  static const Color wechatGreen = Color(0xFF07C160);
  static const Color weiboOrange = Color(0xFFFF8140);
  static const Color qqBlue = Color(0xFF1296DB);
  static const Color alipayBlue = Color(0xFF1677FF);

  // Background Colors
  static const Color backgroundLight = Color(0xFFF5F5F5);
  static const Color backgroundDark = Color(0xFF121212);
  static const Color cardLight = Colors.white;
  static const Color cardDark = Color(0xFF1E1E1E);
  static const Color surfaceLight = Color(0xFFFAFAFA);
  static const Color surfaceDark = Color(0xFF2A2A2A);

  // Text Colors
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textHint = Color(0xFFBDBDBD);
  static const Color textDisabled = Color(0xFFE0E0E0);
  static const Color textOnPrimary = Colors.white;
  static const Color textOnDark = Color(0xFFE0E0E0);

  // Status Colors
  static const Color success = Color(0xFF4CAF50);
  static const Color warning = Color(0xFFFF9800);
  static const Color error = Color(0xFFF44336);
  static const Color info = Color(0xFF2196F3);

  // Learning Colors
  static const Color learningPrimary = Color(0xFF4CAF50);
  static const Color learningSecondary = Color(0xFF8BC34A);
  static const Color learningAccent = Color(0xFFCDDC39);
  static const Color masteredColor = Color(0xFF4CAF50);
  static const Color learningColor = Color(0xFFFF9800);
  static const Color newColor = Color(0xFF2196F3);

  // Shadow Colors
  static const Color shadowLight = Color(0x1A000000);
  static const Color shadowMedium = Color(0x33000000);
  static const Color shadowDark = Color(0x4D000000);
  static const Color shadowColored = Color(0x334CAF50);

  // Border Colors
  static const Color borderLight = Color(0xFFE0E0E0);
  static const Color borderMedium = Color(0xFFBDBDBD);
  static const Color borderDark = Color(0xFF9E9E9E);
  static const Color borderFocus = primaryGreen;

  // Primary Gradients
  static LinearGradient primaryGradient = LinearGradient(
    colors: [primaryGreen, secondaryGreen],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient primaryGradientVertical = LinearGradient(
    colors: [primaryGreen, secondaryGreen],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static LinearGradient primaryGradientReversed = LinearGradient(
    colors: [secondaryGreen, primaryGreen],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Decorative Gradients
  static LinearGradient sunsetGradient = LinearGradient(
    colors: [
      Color(0xFFFF6B6B),
      Color(0xFFFFD93D),
      Color(0xFF6BCF7F),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient oceanGradient = LinearGradient(
    colors: [
      Color(0xFF667EEA),
      Color(0xFF764BA2),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient auroraGradient = LinearGradient(
    colors: [
      Color(0xFF00C9FF),
      Color(0xFF92FE9D),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient lavenderGradient = LinearGradient(
    colors: [
      Color(0xFFE0C3FC),
      Color(0xFF8EC5FC),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient peachGradient = LinearGradient(
    colors: [
      Color(0xFFFFecd2),
      Color(0xFFFcb69f),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient midnightGradient = LinearGradient(
    colors: [
      Color(0xFF2E3192),
      Color(0xFF1BFFFF),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Learning-specific Gradients
  static LinearGradient learningGradient = LinearGradient(
    colors: [learningPrimary, learningSecondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient masteredGradient = LinearGradient(
    colors: [masteredColor, secondaryGreen],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient newWordsGradient = LinearGradient(
    colors: [newColor, Color(0xFF64B5F6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient progressGradient = LinearGradient(
    colors: [
      Color(0xFFFF6B6B),
      Color(0xFF4ECDC4),
    ],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  // Subtle Gradients
  static LinearGradient subtleGradient = LinearGradient(
    colors: [
      Color(0xFFF5F5F5),
      Color(0xFFE8E8E8),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient cardGradient = LinearGradient(
    colors: [
      Colors.white,
      Color(0xFFFAFAFA),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Status-specific Gradients
  static LinearGradient errorGradient = LinearGradient(
    colors: [error, Color(0xFFE57373)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient warningGradient = LinearGradient(
    colors: [warning, Color(0xFFFFB74D)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient infoGradient = LinearGradient(
    colors: [info, Color(0xFF64B5F6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient socialGradient = LinearGradient(
    colors: [wechatGreen, Color(0xFF34D399)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primaryGreen,
      brightness: Brightness.light,
    ),
    primaryColor: primaryGreen,
    scaffoldBackgroundColor: backgroundLight,
    cardColor: cardLight,
    fontFamily: 'PingFang SC',

    appBarTheme: const AppBarTheme(
      elevation: 0,
      centerTitle: true,
      backgroundColor: Colors.white,
      foregroundColor: textPrimary,
      iconTheme: IconThemeData(color: textPrimary),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryGreen,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primaryGreen,
        side: const BorderSide(color: primaryGreen),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    ),

    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: primaryGreen,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: primaryGreen, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.red),
      ),
    ),

    cardTheme: CardThemeData(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      color: cardLight,
    ),
  );

  static ThemeData darkTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primaryGreen,
      brightness: Brightness.dark,
    ),
    primaryColor: primaryGreen,
    scaffoldBackgroundColor: backgroundDark,
    cardColor: cardDark,
    fontFamily: 'PingFang SC',

    appBarTheme: const AppBarTheme(
      elevation: 0,
      centerTitle: true,
      backgroundColor: backgroundDark,
      foregroundColor: Colors.white,
      iconTheme: IconThemeData(color: Colors.white),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryGreen,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: cardDark,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade700),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade700),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: primaryGreen, width: 2),
      ),
    ),

    cardTheme: CardThemeData(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      color: cardDark,
    ),
  );
}

/// Advanced component styles and utilities
class ComponentStyles {
  // Button Styles
  static ButtonStyle primaryButtonStyle = ElevatedButton.styleFrom(
    backgroundColor: AppTheme.primaryGreen,
    foregroundColor: Colors.white,
    elevation: 8,
    shadowColor: AppTheme.shadowColored,
    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
    ),
  );

  static ButtonStyle secondaryButtonStyle = OutlinedButton.styleFrom(
    foregroundColor: AppTheme.primaryGreen,
    side: const BorderSide(color: AppTheme.primaryGreen, width: 2),
    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
    ),
  );

  static ButtonStyle gradientButtonStyle = ElevatedButton.styleFrom(
    padding: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
    ),
    elevation: 8,
    shadowColor: AppTheme.shadowColored,
  );

  // Card Styles
  static BoxDecoration primaryCardDecoration = BoxDecoration(
    color: AppTheme.cardLight,
    borderRadius: BorderRadius.circular(20),
    boxShadow: [
      BoxShadow(
        color: AppTheme.shadowLight,
        blurRadius: 10,
        offset: const Offset(0, 4),
      ),
      BoxShadow(
        color: AppTheme.shadowMedium,
        blurRadius: 20,
        offset: const Offset(0, 8),
      ),
    ],
  );

  static BoxDecoration glassCardDecoration = BoxDecoration(
    color: Colors.white.withOpacity(0.8),
    borderRadius: BorderRadius.circular(20),
    border: Border.all(
      color: Colors.white.withOpacity(0.2),
      width: 1,
    ),
    boxShadow: [
      BoxShadow(
        color: AppTheme.shadowLight,
        blurRadius: 10,
        offset: const Offset(0, 4),
      ),
    ],
  );

  static BoxDecoration gradientCardDecoration = BoxDecoration(
    gradient: AppTheme.primaryGradient,
    borderRadius: BorderRadius.circular(20),
    boxShadow: [
      BoxShadow(
        color: AppTheme.shadowColored,
        blurRadius: 15,
        offset: const Offset(0, 8),
      ),
    ],
  );

  // Input Field Styles
  static InputDecoration primaryInputDecoration = InputDecoration(
    filled: true,
    fillColor: AppTheme.surfaceLight,
    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AppTheme.borderLight),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AppTheme.borderLight),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AppTheme.primaryGreen, width: 2),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AppTheme.error, width: 2),
    ),
    focusedErrorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AppTheme.error, width: 2),
    ),
  );

  // Learning-specific Styles
  static BoxDecoration learningCardDecoration = BoxDecoration(
    gradient: AppTheme.learningGradient,
    borderRadius: BorderRadius.circular(16),
    boxShadow: [
      BoxShadow(
        color: AppTheme.learningPrimary.withOpacity(0.3),
        blurRadius: 12,
        offset: const Offset(0, 6),
      ),
    ],
  );

  static BoxDecoration masteredCardDecoration = BoxDecoration(
    gradient: AppTheme.masteredGradient,
    borderRadius: BorderRadius.circular(16),
    boxShadow: [
      BoxShadow(
        color: AppTheme.masteredColor.withOpacity(0.3),
        blurRadius: 12,
        offset: const Offset(0, 6),
      ),
    ],
  );

  static BoxDecoration newWordsCardDecoration = BoxDecoration(
    gradient: AppTheme.newWordsGradient,
    borderRadius: BorderRadius.circular(16),
    boxShadow: [
      BoxShadow(
        color: AppTheme.newColor.withOpacity(0.3),
        blurRadius: 12,
        offset: const Offset(0, 6),
      ),
    ],
  );

  // Progress Bar Styles
  static BoxDecoration progressBarBackground = BoxDecoration(
    color: AppTheme.surfaceLight,
    borderRadius: BorderRadius.circular(8),
  );

  static BoxDecoration progressBarFill(double progress) => BoxDecoration(
    gradient: AppTheme.progressGradient,
    borderRadius: BorderRadius.circular(8),
  );

  // Navigation Styles
  static BoxDecoration bottomNavigationDecoration = BoxDecoration(
    color: AppTheme.cardLight,
    boxShadow: [
      BoxShadow(
        color: AppTheme.shadowMedium,
        blurRadius: 10,
        offset: const Offset(0, -2),
      ),
    ],
  );

  // Dialog Styles
  static RoundedRectangleBorder dialogShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(24),
  );

  static BoxDecoration dialogDecoration = BoxDecoration(
    color: AppTheme.cardLight,
    borderRadius: BorderRadius.circular(24),
    boxShadow: [
      BoxShadow(
        color: AppTheme.shadowDark,
        blurRadius: 20,
        offset: const Offset(0, 10),
      ),
    ],
  );

  // Animation Curves
  static const Curve primaryCurve = Curves.easeInOutCubic;
  static const Curve secondaryCurve = Curves.easeOutCubic;
  static const Curve springCurve = Curves.elasticOut;
  static const Curve smoothCurve = Curves.easeInOutQuad;

  // Animation Durations
  static const Duration fastDuration = Duration(milliseconds: 200);
  static const Duration normalDuration = Duration(milliseconds: 300);
  static const Duration slowDuration = Duration(milliseconds: 500);

  // Spacing
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
  static const double xxl = 48.0;

  // Border Radius
  static const double radiusSmall = 8.0;
  static const double radiusMedium = 12.0;
  static const double radiusLarge = 16.0;
  static const double radiusXLarge = 20.0;
  static const double radiusXXLarge = 24.0;
}

/// Text styles for different contexts
class AppTextStyles {
  static TextStyle get headline1 => const TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: AppTheme.textPrimary,
    height: 1.2,
  );

  static TextStyle get headline2 => const TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: AppTheme.textPrimary,
    height: 1.2,
  );

  static TextStyle get headline3 => const TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w600,
    color: AppTheme.textPrimary,
    height: 1.3,
  );

  static TextStyle get headline4 => const TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: AppTheme.textPrimary,
    height: 1.3,
  );

  static TextStyle get headline5 => const TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: AppTheme.textPrimary,
    height: 1.3,
  );

  // Backwards compatibility alias
  static TextStyle get headline6 => headline5;

  static TextStyle get bodyLarge => const TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.normal,
    color: AppTheme.textPrimary,
    height: 1.5,
  );

  static TextStyle get bodyMedium => const TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.normal,
    color: AppTheme.textSecondary,
    height: 1.4,
  );

  static TextStyle get bodySmall => const TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.normal,
    color: AppTheme.textHint,
    height: 1.4,
  );

  static TextStyle get caption => const TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.normal,
    color: AppTheme.textHint,
    height: 1.4,
  );

  static TextStyle get buttonText => const TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: Colors.white,
    height: 1.2,
  );

  static TextStyle get inputText => const TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.normal,
    color: AppTheme.textPrimary,
    height: 1.2,
  );

  static TextStyle get labelText => const TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppTheme.textSecondary,
    height: 1.2,
  );
}