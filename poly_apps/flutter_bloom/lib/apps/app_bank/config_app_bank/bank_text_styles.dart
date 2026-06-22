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
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'theme_config_app_bank.dart';

/// Bank Text Styles - Extends common ThemeTextStyles with banking-specific styles
/// Provides centralized text style management for the banking application
/// Inherits from common theme system while adding banking business requirements
class BankTextStyles {
  // Banking-specific heading styles (mapped to common theme styles)
  static const TextStyle headingLarge = ThemeTextStyles.largeTitle;
  static const TextStyle headingMedium = ThemeTextStyles.title2;
  static const TextStyle headingSmall = ThemeTextStyles.title3;

  // Banking-specific body styles (mapped to common theme styles)
  static const TextStyle bodyLarge = ThemeTextStyles.body;
  static const TextStyle bodyMedium = ThemeTextStyles.callout;
  static const TextStyle bodySmall = ThemeTextStyles.footnote;

  // Banking-specific display styles
  static const TextStyle displayLarge = ThemeTextStyles.largeTitle;
  static const TextStyle displayMedium = ThemeTextStyles.title1;
  static const TextStyle displaySmall = ThemeTextStyles.title2;

  // Banking-specific label styles
  static const TextStyle labelLarge = ThemeTextStyles.headline;
  static const TextStyle labelMedium = ThemeTextStyles.subhead;
  static const TextStyle labelSmall = ThemeTextStyles.caption1;

  // Banking-specific themed text styles with colors

  /// Primary text - main content text with primary color
  static TextStyle get primaryText => bodyLarge.copyWith(
    color: BankThemeConfig.primaryText,
    fontWeight: FontWeight.w400,
  );

  /// Secondary text - supporting content with secondary color
  static TextStyle get secondaryText => bodyMedium.copyWith(
    color: BankThemeConfig.secondaryText,
    fontWeight: FontWeight.w400,
  );

  /// White text - for use on dark backgrounds
  static TextStyle get whiteText => bodyMedium.copyWith(
    color: BankThemeConfig.whiteText,
    fontWeight: FontWeight.w400,
  );

  /// Balance amount text - large emphasized text for displaying balances
  static TextStyle get balanceAmount => displayLarge.copyWith(
    color: BankThemeConfig.whiteText,
    fontWeight: FontWeight.bold,
    fontSize: 32,
  );

  /// Balance label text - smaller text for balance labels
  static TextStyle get balanceLabel => bodySmall.copyWith(
    color: BankThemeConfig.whiteText.withOpacity(0.8),
  );

  /// Section title text - for section headers
  static TextStyle get sectionTitle => headingSmall.copyWith(
    color: BankThemeConfig.primaryText,
    fontWeight: FontWeight.bold,
  );

  /// Card title text - for card headers
  static TextStyle get cardTitle => bodyLarge.copyWith(
    color: BankThemeConfig.primaryText,
    fontWeight: FontWeight.w600,
  );

  /// Card subtitle text - for card supporting text
  static TextStyle get cardSubtitle => bodySmall.copyWith(
    color: BankThemeConfig.secondaryText,
  );

  /// Transaction amount positive - green text for positive amounts
  static TextStyle get transactionPositive => bodyLarge.copyWith(
    color: BankThemeConfig.successColor,
    fontWeight: FontWeight.bold,
  );

  /// Transaction amount negative - red text for negative amounts
  static TextStyle get transactionNegative => bodyLarge.copyWith(
    color: BankThemeConfig.errorColor,
    fontWeight: FontWeight.bold,
  );

  /// Button text - for button labels
  static TextStyle get buttonText => bodyMedium.copyWith(
    fontWeight: FontWeight.w600,
  );

  /// Button text primary - white text for primary buttons
  static TextStyle get buttonTextPrimary => buttonText.copyWith(
    color: BankThemeConfig.whiteText,
  );

  /// Button text secondary - primary color text for secondary buttons
  static TextStyle get buttonTextSecondary => buttonText.copyWith(
    color: BankThemeConfig.primaryBlue,
  );

  /// App bar title text - for app bar titles
  static TextStyle get appBarTitle => headingMedium.copyWith(
    color: BankThemeConfig.whiteText,
    fontWeight: FontWeight.w600,
  );

  /// Navigation label text - for bottom navigation labels
  static TextStyle get navigationLabel => bodySmall.copyWith(
    fontWeight: FontWeight.w500,
  );

  /// Quick action label text - for quick action button labels
  static TextStyle get quickActionLabel => bodySmall.copyWith(
    color: BankThemeConfig.primaryText,
    fontWeight: FontWeight.w500,
    fontSize: 12,
  );

  /// Credit card number text - monospace for card numbers
  static TextStyle get creditCardNumber => bodyLarge.copyWith(
    color: BankThemeConfig.whiteText,
    fontFamily: ThemeTextStyles.monospaceFontFamily,
    letterSpacing: 2.0,
    fontWeight: FontWeight.w300,
  );

  /// Credit card label text - for card field labels
  static TextStyle get creditCardLabel => bodySmall.copyWith(
    color: BankThemeConfig.whiteText.withOpacity(0.7),
    fontSize: 10,
  );

  /// Status text - for status indicators
  static TextStyle get statusText => bodySmall.copyWith(
    fontWeight: FontWeight.w500,
    fontSize: 10,
  );

  /// Date text - for displaying dates
  static TextStyle get dateText => bodySmall.copyWith(
    color: BankThemeConfig.secondaryText,
    fontSize: 11,
  );

  /// Reference text - for transaction references
  static TextStyle get referenceText => bodySmall.copyWith(
    color: BankThemeConfig.secondaryText,
    fontSize: 11,
  );

  /// Welcome message text - for greeting text
  static TextStyle get welcomeMessage => bodySmall.copyWith(
    color: BankThemeConfig.whiteText.withOpacity(0.8),
  );

  /// User name text - for displaying user names
  static TextStyle get userName => bodyMedium.copyWith(
    color: BankThemeConfig.whiteText,
    fontWeight: FontWeight.w600,
  );

  // Utility methods for dynamic styling

  /// Get transaction amount style based on amount value
  static TextStyle getTransactionAmountStyle(double amount) {
    return amount >= 0 ? transactionPositive : transactionNegative;
  }

  /// Get text style with custom color
  static TextStyle getTextWithColor(TextStyle baseStyle, Color color) {
    return baseStyle.copyWith(color: color);
  }

  /// Get text style with custom opacity
  static TextStyle getTextWithOpacity(TextStyle baseStyle, double opacity) {
    return baseStyle.copyWith(
      color: baseStyle.color?.withOpacity(opacity),
    );
  }

  /// Get scaled text style
  static TextStyle getScaledText(TextStyle baseStyle, double scaleFactor) {
    return baseStyle.copyWith(
      fontSize: (baseStyle.fontSize ?? 16) * scaleFactor,
    );
  }

  // Banking-specific text style combinations

  /// Account balance display style
  static TextStyle get accountBalance => balanceAmount;

  /// Account type label style
  static TextStyle get accountTypeLabel => balanceLabel;

  /// Transaction title style
  static TextStyle get transactionTitle => cardTitle;

  /// Transaction subtitle style
  static TextStyle get transactionSubtitle => cardSubtitle;

  /// Quick action button label style
  static TextStyle get quickActionButton => quickActionLabel;

  /// Section header style
  static TextStyle get sectionHeader => sectionTitle;

  /// Card number display style
  static TextStyle get cardNumberDisplay => creditCardNumber;

  /// Bank name style (for credit cards)
  static TextStyle get bankName => creditCardLabel.copyWith(
    letterSpacing: 1.2,
  );

  /// Card type style (for credit cards)
  static TextStyle get cardType => creditCardLabel.copyWith(
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
  );

  /// Status indicator style
  static TextStyle get statusIndicator => statusText;

  /// Timestamp style
  static TextStyle get timestamp => dateText;

  /// Transaction reference style
  static TextStyle get transactionReference => referenceText;
}