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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Bank App Theme Configuration
/// Inherits from common theme system and applies banking-specific color scheme
/// Based on UI references: Blue gradient background with white cards and teal accents
class BankThemeConfig {
  // Primary Brand Colors (Based on UI images - Blue gradient banking theme)
  static const Color primaryBlue = Color(0xFF4A90E2);  // Main blue from UI
  static const Color primaryBlueDark = Color(0xFF357ABD); // Darker blue for gradients
  static const Color accentTeal = Color(0xFF00BCD4); // Teal accent from UI
  static const Color secondaryBlue = Color(0xFF2196F3); // Secondary blue

  // Card and Surface Colors
  static const Color cardBackground = ThemeColors.white;
  static const Color surfaceBackground = Color(0xFFF4FCFF); // Light blue background
  static const Color dividerColor = Color(0xFFE0E0E0);

  // Text Colors
  static const Color primaryText = Color(0xFF2C3E50);
  static const Color secondaryText = Color(0xFF7F8C8D);
  static const Color whiteText = ThemeColors.white;

  // Action Colors (Based on UI quick action buttons)
  static const Color transferColor = Color(0xFF4CAF50); // Green for transfers
  static const Color paymentColor = Color(0xFF2196F3); // Blue for payments
  static const Color cardColor = Color(0xFFFF9800); // Orange for cards
  static const Color investmentColor = Color(0xFF9C27B0); // Purple for investments

  // Status Colors
  static const Color successColor = ThemeColors.green;
  static const Color errorColor = ThemeColors.red;
  static const Color warningColor = ThemeColors.orange;
  static const Color infoColor = primaryBlue;

  // Gradient Definitions (From UI background patterns)
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [primaryBlue, primaryBlueDark],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2C3E50), Color(0xFF34495E)],
  );

  static const LinearGradient promoGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFF6B35), Color(0xFFFF8E53)],
  );

  // Shadows and Elevations
  static const BoxShadow cardShadow = BoxShadow(
    color: Color(0x1A000000),
    blurRadius: 8,
    offset: Offset(0, 2),
  );

  static const BoxShadow buttonShadow = BoxShadow(
    color: Color(0x33000000),
    blurRadius: 4,
    offset: Offset(0, 2),
  );

  // Border Radius (Consistent with UI design)
  static const double cardRadius = 16.0;
  static const double buttonRadius = 12.0;
  static const double smallRadius = 8.0;

  // Spacing (Inherits from ThemeDimensions but with banking-specific adjustments)
  static const double sectionSpacing = ThemeDimensions.spacingLarge;
  static const double itemSpacing = ThemeDimensions.spacingMedium;
  static const double cardPadding = ThemeDimensions.paddingSizeLarge;

  // Quick Action Button Colors (From UI grid layout)
  static const List<Color> quickActionColors = [
    transferColor,   // Transfer
    paymentColor,    // Pay Bills
    cardColor,       // Cards
    investmentColor, // Investment
  ];

  // Bottom Navigation Colors (From UI bottom nav)
  static const Color bottomNavBackground = cardBackground;
  static const Color bottomNavSelected = primaryBlue;
  static const Color bottomNavUnselected = secondaryText;

  // Input Field Colors
  static const Color inputBorder = dividerColor;
  static const Color inputFocus = primaryBlue;
  static const Color inputBackground = cardBackground;

  // Theme Data Generators
  static ThemeData getLightTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryBlue,
        brightness: Brightness.light,
        primary: primaryBlue,
        secondary: accentTeal,
        surface: cardBackground,
        background: surfaceBackground,
        error: errorColor,
      ),
      scaffoldBackgroundColor: surfaceBackground,
      appBarTheme: AppBarTheme(
        backgroundColor: primaryBlue,
        foregroundColor: whiteText,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: ThemeTextStyles.title2.copyWith(
          color: whiteText,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardThemeData(
        color: cardBackground,
        elevation: 4,
        shadowColor: cardShadow.color,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryBlue,
          foregroundColor: whiteText,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(buttonRadius),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeLarge,
            vertical: ThemeDimensions.paddingSizeDefault,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: inputBackground,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(smallRadius),
          borderSide: const BorderSide(color: inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(smallRadius),
          borderSide: const BorderSide(color: inputFocus, width: 2),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: bottomNavBackground,
        selectedItemColor: bottomNavSelected,
        unselectedItemColor: bottomNavUnselected,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
    );
  }

  // Utility Methods for Banking-Specific Styling
  static BoxDecoration getCardDecoration({bool withShadow = true}) {
    return BoxDecoration(
      color: cardBackground,
      borderRadius: BorderRadius.circular(cardRadius),
      boxShadow: withShadow ? [cardShadow] : null,
    );
  }

  static BoxDecoration getGradientDecoration(LinearGradient gradient) {
    return BoxDecoration(
      gradient: gradient,
      borderRadius: BorderRadius.circular(cardRadius),
      boxShadow: const [cardShadow],
    );
  }

  static Color getQuickActionColor(int index) {
    return quickActionColors[index % quickActionColors.length];
  }

  static TextStyle getPrimaryTextStyle() {
    return ThemeTextStyles.body.copyWith(color: primaryText);
  }

  static TextStyle getSecondaryTextStyle() {
    return ThemeTextStyles.callout.copyWith(color: secondaryText);
  }

  static TextStyle getWhiteTextStyle() {
    return ThemeTextStyles.callout.copyWith(color: whiteText);
  }

  // Transaction Type Colors
  static Color getTransactionColor(bool isPositive) {
    return isPositive ? successColor : errorColor;
  }

  // Balance Visibility Colors
  static const Color balanceVisibleIcon = whiteText;
  static const Color balanceHiddenIcon = Color(0xFFBDBDBD);
}

/// Bank App Color Provider
/// 
/// Provides centralized color management for the bank application.
/// All colors are defined here to ensure consistency across the app.
/// 
/// USAGE:
/// ```dart
/// backgroundColor: BankColorProvider.scaffoldBackground
/// ```
class BankColorProvider {
  // Private constructor to prevent instantiation
  BankColorProvider._();

  // Background Colors
  static const Color scaffoldBackground = Color(0xFFF4FCFF); // Light blue background
  static const Color cardBackground = ThemeColors.white;
  static const Color surfaceBackground = Color(0xFFF4FCFF);
  
  // Primary Colors
  static const Color primaryBlue = Color(0xFF4A90E2);
  static const Color primaryBlueDark = Color(0xFF357ABD);
  static const Color accentTeal = Color(0xFF00BCD4);
  static const Color secondaryBlue = Color(0xFF2196F3);
  
  // Text Colors
  static const Color primaryText = Color(0xFF2C3E50);
  static const Color secondaryText = Color(0xFF7F8C8D);
  static const Color whiteText = ThemeColors.white;
  
  // Action Colors
  static const Color transferColor = Color(0xFF4CAF50);
  static const Color paymentColor = Color(0xFF2196F3);
  static const Color cardColor = Color(0xFFFF9800);
  static const Color investmentColor = Color(0xFF9C27B0);
  
  // Status Colors
  static const Color successColor = ThemeColors.green;
  static const Color errorColor = ThemeColors.red;
  static const Color warningColor = ThemeColors.orange;
  static const Color infoColor = primaryBlue;
  
  // Utility Colors
  static const Color dividerColor = Color(0xFFE0E0E0);
  static const Color balanceVisibleIcon = whiteText;
  static const Color balanceHiddenIcon = Color(0xFFBDBDBD);
  
  // Navigation Colors
  static const Color bottomNavBackground = cardBackground;
  static const Color bottomNavSelected = primaryBlue;
  static const Color bottomNavUnselected = secondaryText;
  
  // Input Field Colors
  static const Color inputBorder = dividerColor;
  static const Color inputFocus = primaryBlue;
  static const Color inputBackground = cardBackground;
}