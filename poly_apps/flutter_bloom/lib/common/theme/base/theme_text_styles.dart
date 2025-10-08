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
import 'theme_colors.dart';

class ThemeTextStyles {
  // Font families
  static const String primaryFontFamily = 'SF Pro Display';
  static const String secondaryFontFamily = 'SF Pro Text';
  static const String monospaceFontFamily = 'SF Mono';

  // Large Title (iOS 34pt)
  static const TextStyle largeTitle = TextStyle(
    fontSize: 34.0,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.37,
    height: 1.12,
    fontFamily: primaryFontFamily,
  );

  static const TextStyle largeTitleBold = TextStyle(
    fontSize: 34.0,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.37,
    height: 1.12,
    fontFamily: primaryFontFamily,
  );

  // Title 1 (iOS 28pt)
  static const TextStyle title1 = TextStyle(
    fontSize: 28.0,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.36,
    height: 1.14,
    fontFamily: primaryFontFamily,
  );

  static const TextStyle title1Bold = TextStyle(
    fontSize: 28.0,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.36,
    height: 1.14,
    fontFamily: primaryFontFamily,
  );

  // Title 2 (iOS 22pt)
  static const TextStyle title2 = TextStyle(
    fontSize: 22.0,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.35,
    height: 1.18,
    fontFamily: primaryFontFamily,
  );

  static const TextStyle title2Bold = TextStyle(
    fontSize: 22.0,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.35,
    height: 1.18,
    fontFamily: primaryFontFamily,
  );

  // Title 3 (iOS 20pt)
  static const TextStyle title3 = TextStyle(
    fontSize: 20.0,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.38,
    height: 1.20,
    fontFamily: primaryFontFamily,
  );

  static const TextStyle title3Bold = TextStyle(
    fontSize: 20.0,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.38,
    height: 1.20,
    fontFamily: primaryFontFamily,
  );

  // Headline (iOS 17pt)
  static const TextStyle headline = TextStyle(
    fontSize: 17.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.41,
    height: 1.29,
    fontFamily: secondaryFontFamily,
  );

  // Body (iOS 17pt)
  static const TextStyle body = TextStyle(
    fontSize: 17.0,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.41,
    height: 1.29,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle bodyBold = TextStyle(
    fontSize: 17.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.41,
    height: 1.29,
    fontFamily: secondaryFontFamily,
  );

  // Callout (iOS 16pt)
  static const TextStyle callout = TextStyle(
    fontSize: 16.0,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.32,
    height: 1.31,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle calloutBold = TextStyle(
    fontSize: 16.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.32,
    height: 1.31,
    fontFamily: secondaryFontFamily,
  );

  // Subhead (iOS 15pt)
  static const TextStyle subhead = TextStyle(
    fontSize: 15.0,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.24,
    height: 1.33,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle subheadBold = TextStyle(
    fontSize: 15.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.24,
    height: 1.33,
    fontFamily: secondaryFontFamily,
  );

  // Footnote (iOS 13pt)
  static const TextStyle footnote = TextStyle(
    fontSize: 13.0,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.08,
    height: 1.38,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle footnoteBold = TextStyle(
    fontSize: 13.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.08,
    height: 1.38,
    fontFamily: secondaryFontFamily,
  );

  // Caption 1 (iOS 12pt)
  static const TextStyle caption1 = TextStyle(
    fontSize: 12.0,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.0,
    height: 1.33,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle caption1Bold = TextStyle(
    fontSize: 12.0,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.0,
    height: 1.33,
    fontFamily: secondaryFontFamily,
  );

  // Caption 2 (iOS 11pt)
  static const TextStyle caption2 = TextStyle(
    fontSize: 11.0,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.07,
    height: 1.36,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle caption2Bold = TextStyle(
    fontSize: 11.0,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.07,
    height: 1.36,
    fontFamily: secondaryFontFamily,
  );

  // Button text styles
  static const TextStyle buttonLarge = TextStyle(
    fontSize: 17.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.41,
    height: 1.29,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle buttonMedium = TextStyle(
    fontSize: 15.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.24,
    height: 1.33,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle buttonSmall = TextStyle(
    fontSize: 13.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.08,
    height: 1.38,
    fontFamily: secondaryFontFamily,
  );

  // Navigation text styles
  static const TextStyle navigationTitle = TextStyle(
    fontSize: 17.0,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.41,
    height: 1.29,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle navigationLargeTitle = TextStyle(
    fontSize: 34.0,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.37,
    height: 1.12,
    fontFamily: primaryFontFamily,
  );

  // Tab bar text styles
  static const TextStyle tabBarItem = TextStyle(
    fontSize: 10.0,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.12,
    height: 1.2,
    fontFamily: secondaryFontFamily,
  );

  // Input text styles
  static const TextStyle inputText = TextStyle(
    fontSize: 17.0,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.41,
    height: 1.29,
    fontFamily: secondaryFontFamily,
  );

  static const TextStyle inputPlaceholder = TextStyle(
    fontSize: 17.0,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.41,
    height: 1.29,
    fontFamily: secondaryFontFamily,
    color: ThemeColors.tertiaryLabel,
  );

  // Code text styles
  static const TextStyle codeBlock = TextStyle(
    fontSize: 14.0,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.0,
    height: 1.43,
    fontFamily: monospaceFontFamily,
  );

  static const TextStyle codeInline = TextStyle(
    fontSize: 15.0,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.0,
    height: 1.33,
    fontFamily: monospaceFontFamily,
  );

  // Utility methods
  static TextStyle withColor(TextStyle style, Color color) {
    return style.copyWith(color: color);
  }

  static TextStyle withSize(TextStyle style, double fontSize) {
    return style.copyWith(fontSize: fontSize);
  }

  static TextStyle withWeight(TextStyle style, FontWeight fontWeight) {
    return style.copyWith(fontWeight: fontWeight);
  }

  static TextStyle withOpacity(TextStyle style, double opacity) {
    return style.copyWith(color: style.color?.withOpacity(opacity));
  }

  // Platform-specific text styles
  
  // App-specific text styles for word card functionality
  static const TextStyle wordTitle = TextStyle(
    fontSize: 32.0,
    fontWeight: FontWeight.bold,
    color: ThemeColors.label,
    fontFamily: primaryFontFamily,
    letterSpacing: 0.5,
    height: 1.2,
  );

  static const TextStyle phoneticText = TextStyle(
    fontSize: 18.0,
    color: ThemeColors.secondaryLabel,
    fontFamily: secondaryFontFamily,
    fontStyle: FontStyle.italic,
    letterSpacing: 0.2,
  );

  static const TextStyle translationText = TextStyle(
    fontSize: 20.0,
    color: ThemeColors.label,
    fontFamily: secondaryFontFamily,
    fontWeight: FontWeight.w500,
    height: 1.3,
  );

  static const TextStyle exampleTitle = TextStyle(
    fontSize: 16.0,
    fontWeight: FontWeight.bold,
    color: ThemeColors.label,
    fontFamily: secondaryFontFamily,
    letterSpacing: 0.1,
  );

  static const TextStyle exampleText = TextStyle(
    fontSize: 16.0,
    color: ThemeColors.secondaryLabel,
    fontFamily: secondaryFontFamily,
    fontStyle: FontStyle.italic,
    height: 1.4,
  );




  /// Get themed style based on context brightness
  static TextStyle getThemedStyle(TextStyle style, BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return style.copyWith(
      color: isDark ? ThemeColors.labelDark : ThemeColors.label,
    );
  }

  /// Create responsive text style based on screen size
  static TextStyle getResponsiveStyle(TextStyle baseStyle, BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    double scaleFactor = 1.0;

    if (screenWidth < 360) {
      scaleFactor = 0.9; // Small screens
    } else if (screenWidth > 768) {
      scaleFactor = 1.1; // Large screens/tablets
    }

    return baseStyle.copyWith(
      fontSize: (baseStyle.fontSize ?? 16) * scaleFactor,
    );
  }

  /// Check if current theme is dark
  static bool isDarkTheme(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark;
  }

  /// Get screen size category
  static String getScreenSizeCategory(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    if (screenWidth < 360) return 'small';
    if (screenWidth > 768) return 'large';
    return 'medium';
  }

  /// Get responsive padding based on screen size
  static EdgeInsets getResponsivePadding(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    if (screenWidth < 360) {
      return const EdgeInsets.all(8.0);
    } else if (screenWidth > 768) {
      return const EdgeInsets.all(24.0);
    }
    return const EdgeInsets.all(16.0);
  }

  /// Get adaptive border radius based on screen size
  static BorderRadius getAdaptiveBorderRadius(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    double radius = 8.0;
    
    if (screenWidth < 360) {
      radius = 4.0; // Small screens
    } else if (screenWidth > 768) {
      radius = 12.0; // Large screens/tablets
    }
    
    return BorderRadius.circular(radius);
  }

  /// Button style properties for backward compatibility
  static ButtonStyle get primaryButtonStyle => ElevatedButton.styleFrom(
    backgroundColor: ThemeColors.blue,
    foregroundColor: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8.0),
    ),
  );

  static ButtonStyle get secondaryButtonStyle => OutlinedButton.styleFrom(
    foregroundColor: ThemeColors.blue,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8.0),
    ),
  );

  static ButtonStyle get dangerButtonStyle => ElevatedButton.styleFrom(
    backgroundColor: Colors.red,
    foregroundColor: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8.0),
    ),
  );




  static TextStyle getPlatformTitle(TargetPlatform platform) {
    switch (platform) {
      case TargetPlatform.iOS:
        return navigationLargeTitle;
      case TargetPlatform.android:
        return title1Bold;
      default:
        return title1Bold;
    }
  }

  static TextStyle getPlatformBody(TargetPlatform platform) {
    switch (platform) {
      case TargetPlatform.iOS:
        return body;
      case TargetPlatform.android:
        return body.copyWith(fontSize: 16.0);
      default:
        return body;
    }
  }

  // Text theme generators
  static TextTheme lightTextTheme = TextTheme(
    displayLarge: largeTitle.copyWith(color: ThemeColors.label),
    displayMedium: title1.copyWith(color: ThemeColors.label),
    displaySmall: title2.copyWith(color: ThemeColors.label),
    headlineLarge: title3.copyWith(color: ThemeColors.label),
    headlineMedium: headline.copyWith(color: ThemeColors.label),
    headlineSmall: subhead.copyWith(color: ThemeColors.label),
    titleLarge: title3.copyWith(color: ThemeColors.label),
    titleMedium: callout.copyWith(color: ThemeColors.label),
    titleSmall: subhead.copyWith(color: ThemeColors.label),
    bodyLarge: body.copyWith(color: ThemeColors.label),
    bodyMedium: callout.copyWith(color: ThemeColors.label),
    bodySmall: footnote.copyWith(color: ThemeColors.secondaryLabel),
    labelLarge: buttonLarge.copyWith(color: ThemeColors.label),
    labelMedium: buttonMedium.copyWith(color: ThemeColors.label),
    labelSmall: caption1.copyWith(color: ThemeColors.tertiaryLabel),
  );

  static TextTheme darkTextTheme = TextTheme(
    displayLarge: largeTitle.copyWith(color: ThemeColors.labelDark),
    displayMedium: title1.copyWith(color: ThemeColors.labelDark),
    displaySmall: title2.copyWith(color: ThemeColors.labelDark),
    headlineLarge: title3.copyWith(color: ThemeColors.labelDark),
    headlineMedium: headline.copyWith(color: ThemeColors.labelDark),
    headlineSmall: subhead.copyWith(color: ThemeColors.labelDark),
    titleLarge: title3.copyWith(color: ThemeColors.labelDark),
    titleMedium: callout.copyWith(color: ThemeColors.labelDark),
    titleSmall: subhead.copyWith(color: ThemeColors.labelDark),
    bodyLarge: body.copyWith(color: ThemeColors.labelDark),
    bodyMedium: callout.copyWith(color: ThemeColors.labelDark),
    bodySmall: footnote.copyWith(color: ThemeColors.secondaryLabelDark),
    labelLarge: buttonLarge.copyWith(color: ThemeColors.labelDark),
    labelMedium: buttonMedium.copyWith(color: ThemeColors.labelDark),
    labelSmall: caption1.copyWith(color: ThemeColors.tertiaryLabelDark),
  );

  // These styles provide backward compatibility with the old style system

  /// Base text styles with different font weights - matching legacy styles.dart
  static const TextStyle sfProLight = TextStyle(
    fontFamily: 'SFProText',
    fontWeight: FontWeight.w300,
  );

  static const TextStyle textRegular = TextStyle(
    fontFamily: 'SFProText',
    fontWeight: FontWeight.w400,
  );

  static const TextStyle textMedium = TextStyle(
    fontFamily: 'SFProText',
    fontWeight: FontWeight.w500,
  );

  static const TextStyle textSemiBold = TextStyle(
    fontFamily: 'SFProText',
    fontWeight: FontWeight.w600,
  );

  static const TextStyle textBold = TextStyle(
    fontFamily: 'SFProText',
    fontWeight: FontWeight.w700,
  );

  static const TextStyle textHeavy = TextStyle(
    fontFamily: 'SFProText',
    fontWeight: FontWeight.w900,
  );

  static const TextStyle mediumtextStyle = TextStyle(
    fontFamily: 'SFProText',
    color: Color(0xFF0B9722)
  );


  /// Map theme styles to semantic names that all apps can use
  static TextStyle get appTitle => title1Bold;
  static TextStyle get appSubtitle => title3;
  static TextStyle get appBody => body;
  static TextStyle get appCaption => caption1;
  static TextStyle get appButton => buttonMedium;
  static TextStyle get appNavigation => navigationTitle;

  // These provide backward compatibility with old style names

  /// Semantic aliases for backward compatibility
  static const TextStyle light = sfProLight;
  static const TextStyle regular = textRegular;
  static const TextStyle medium = textMedium;
  static const TextStyle semiBold = textSemiBold;
  static const TextStyle bold = textBold;
  static const TextStyle heavy = textHeavy;


  /// Content title style
  static TextStyle get contentTitle => textBold.copyWith(fontSize: 18);

  /// Content subtitle style
  static TextStyle get contentSubtitle => textSemiBold.copyWith(fontSize: 16);

  /// Content body style
  static TextStyle get contentBody => textMedium.copyWith(fontSize: 14);

  /// Content detail style
  static TextStyle get contentDetail => textRegular.copyWith(fontSize: 12);

  // These provide Material Design style names for compatibility
  
  static const TextStyle headline1 = largeTitle;
  static const TextStyle headline2 = title1;
  static const TextStyle headline3 = title2;
  static const TextStyle headline4 = title3;
  static const TextStyle headline5 = headline;
  static const TextStyle headline6 = subhead;
  static const TextStyle bodyText1 = body;
  static const TextStyle bodyText2 = callout;
  static const TextStyle subtitle1 = subhead;
  static const TextStyle subtitle2 = footnote;
  static const TextStyle button = buttonMedium;
  static const TextStyle overline = caption2;
  
  // Additional semantic aliases
  static const TextStyle displayLarge = largeTitle;
  static const TextStyle displayMedium = title1;
  static const TextStyle displaySmall = title2;
  static const TextStyle titleLarge = title3;
  static const TextStyle titleMedium = headline;
  static const TextStyle titleSmall = subhead;
  static const TextStyle bodyLarge = body;
  static const TextStyle bodyMedium = callout;
  static const TextStyle bodySmall = footnote;
  static const TextStyle labelLarge = buttonLarge;
  static const TextStyle labelMedium = buttonMedium;
  static const TextStyle labelSmall = caption1;

  // Modern heading aliases for consistent app usage
  static const TextStyle headingLarge = largeTitle;      // 34pt - Large titles
  static const TextStyle headingMedium = title2;         // 22pt - Section headers
  static const TextStyle headingSmall = title3;          // 20pt - Subsection headers

  // These are commonly used styles found in the codebase

  /// Button text style - commonly used across all apps
  static const TextStyle buttonText = buttonMedium;

  // Additional getters for compatibility (removed duplicates)

  /// Donation title style
  static TextStyle get donationTitle => textBold.copyWith(
    fontSize: 18,
    color: ThemeColors.label,
  );

  /// Donation amount style
  static TextStyle get donationAmount => textBold.copyWith(
    fontSize: 20,
    color: ThemeColors.green,
  );

  /// Donation description style
  static TextStyle get donationDescription => textMedium.copyWith(
    fontSize: 14,
    color: ThemeColors.secondaryLabel,
  );

  /// Prayer title style
  static TextStyle get prayerTitle => textSemiBold.copyWith(
    fontSize: 16,
    color: ThemeColors.brown,
  );

  /// Prayer content style
  static TextStyle get prayerContent => textMedium.copyWith(
    fontSize: 14,
    color: ThemeColors.secondaryLabel,
  );

  /// Profile name style
  static TextStyle get profileName => textBold.copyWith(
    fontSize: 16,
    color: ThemeColors.label,
  );

  /// Profile detail style
  static TextStyle get profileDetail => textMedium.copyWith(
    fontSize: 14,
    color: ThemeColors.secondaryLabel,
  );


  /// Primary button text style
  static TextStyle get primaryButton => textSemiBold.copyWith(color: ThemeColors.white);

  /// Secondary button text style
  static TextStyle get secondaryButton => textMedium.copyWith(color: ThemeColors.blue);

  /// Danger button text style
  static TextStyle get dangerButton => textSemiBold.copyWith(color: ThemeColors.white);


  /// Fundraising title style
  static TextStyle get fundraisingTitle => textBold.copyWith(
    fontSize: 16,
    color: ThemeColors.label,
  );

  /// Fundraising progress style
  static TextStyle get fundraisingProgress => textMedium.copyWith(
    fontSize: 14,
    color: ThemeColors.secondaryLabel,
  );
}
