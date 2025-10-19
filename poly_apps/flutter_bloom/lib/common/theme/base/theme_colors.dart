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

class ThemeColors {
  // Black gradient series (from medium black to pure black)
  static const Color black = Color(0xFF000000); // Pure black
  static const Color black100 = Color(0xFF1A1A1A); // 90% black
  static const Color black90 = Color(0xFF2A2A2A); // 80% black
  static const Color black80 = Color(0xFF3A3A3A); // 70% black
  static const Color black70 = Color(0xFF4A4A4A); // 60% black
  static const Color black60 = Color(0xFF5A5A5A); // 50% black
  static const Color black50 = Color(0xFF6A6A6A); // 40% black
  static const Color black40 = Color(0xFF7A7A7A); // 30% black
  static const Color black30 = Color(0xFF8A8A8A); // 20% black
  static const Color black20 = Color(0xFF9A9A9A); // 10% black
  static const Color black10 = Color(0xFFA0A0A0); // 10% black

  // White gradient series (from pure white to gray white)
  static const Color white = Color(0xFFFFFFFF); // Pure white
  static const Color white100 = Color(0xFFFAFAFA); // 98% white
  static const Color white90 = Color(0xFFF5F5F5); // 96% white
  static const Color white80 = Color(0xFFF0F0F0); // 94% white
  static const Color white70 = Color(0xFFEBEBEB); // 92% white
  static const Color white60 = Color(0xFFE6E6E6); // 90% white
  static const Color white50 = Color(0xFFE1E1E1); // 88% white
  static const Color white40 = Color(0xFFDCDCDC); // 86% white
  static const Color white30 = Color(0xFFD7D7D7); // 84% white
  static const Color white20 = Color(0xFFD2D2D2); // 82% white
  static const Color white10 = Color(0xFFCDCDCD); // 80% white

  // Blue gradient series
  static const Color blue = Color(0xFF007AFF); // iOS blue
  static const Color blue100 = Color(0xFF0051D5); // Dark blue
  static const Color blue90 = Color(0xFF0066FF); // Medium dark blue
  static const Color blue80 = Color(0xFF1A7AFF); // Medium blue
  static const Color blue70 = Color(0xFF338EFF); // Light medium blue
  static const Color blue60 = Color(0xFF4DA2FF); // Light blue
  static const Color blue50 = Color(0xFF66B6FF); // Very light blue
  static const Color blue40 = Color(0xFF80CAFF); // Ultra light blue
  static const Color blue05 = Color(0xFFE6F3FF); // Very light blue
  static const Color blue30 = Color(0xFF99DEFF); // Pale blue
  static const Color blue20 = Color(0xFFB3F2FF); // Very pale blue
  static const Color blue10 = Color(0xFFCCF6FF); // Almost white blue

  // Green gradient series
  static const Color green = Color(0xFF34C759); // iOS green
  static const Color green100 = Color(0xFF248A3D); // Dark green
  static const Color green90 = Color(0xFF2D9F47); // Medium dark green
  static const Color green80 = Color(0xFF36B451); // Medium green
  static const Color green70 = Color(0xFF3FC95B); // Light medium green
  static const Color green60 = Color(0xFF48DE65); // Light green
  static const Color green50 = Color(0xFF51F36F); // Very light green
  static const Color green40 = Color(0xFF5AFF79); // Ultra light green
  static const Color green05 = Color(0xFFE6F7E6); // Very light green
  static const Color green30 = Color(0xFF63FF83); // Pale green
  static const Color green20 = Color(0xFF6CFF8D); // Very pale green
  static const Color green10 = Color(0xFF75FF97); // Almost white green

  // Red gradient series
  static const Color red = Color(0xFFFF3B30); // iOS red
  static const Color red100 = Color(0xFFD70015); // Dark red
  static const Color red90 = Color(0xFFE6001A); // Medium dark red
  static const Color red80 = Color(0xFFF5001F); // Medium red
  static const Color red70 = Color(0xFFFF1A35); // Light medium red
  static const Color red60 = Color(0xFFFF333A); // Light red
  static const Color red50 = Color(0xFFFF4D4F); // Very light red
  static const Color red40 = Color(0xFFFF6664); // Ultra light red
  static const Color red30 = Color(0xFFFF8079); // Pale red
  static const Color red20 = Color(0xFFFF998E); // Very pale red
  static const Color red10 = Color(0xFFFFB3A3); // Almost white red

  // Orange gradient series
  static const Color orange = Color(0xFFFF9500); // iOS orange
  static const Color orange100 = Color(0xFFCC7700); // Dark orange
  static const Color orange90 = Color(0xFFE68500); // Medium dark orange
  static const Color orange80 = Color(0xFFFF9300); // Medium orange
  static const Color orange70 = Color(0xFFFFA100); // Light medium orange
  static const Color orange60 = Color(0xFFFFAF00); // Light orange
  static const Color orange50 = Color(0xFFFFBD00); // Very light orange
  static const Color orange40 = Color(0xFFFFCB00); // Ultra light orange
  static const Color orange30 = Color(0xFFFFD900); // Pale orange
  static const Color orange20 = Color(0xFFFFE700); // Very pale orange
  static const Color orange10 = Color(0xFFFFF500); // Almost white orange

  // Purple gradient series
  static const Color purple = Color(0xFFAF52DE); // iOS purple
  static const Color purple100 = Color(0xFF8E44AD); // Dark purple
  static const Color purple90 = Color(0xFF9B59B6); // Medium dark purple
  static const Color purple80 = Color(0xFFA569BD); // Medium purple
  static const Color purple70 = Color(0xFFB078C4); // Light medium purple
  static const Color purple60 = Color(0xFFBB88CB); // Light purple
  static const Color purple50 = Color(0xFFC698D2); // Very light purple
  static const Color purple40 = Color(0xFFD1A7D9); // Ultra light purple
  static const Color purple30 = Color(0xFFDCB7E0); // Pale purple
  static const Color purple20 = Color(0xFFE7C6E7); // Very pale purple
  static const Color purple10 = Color(0xFFF2D6EE); // Almost white purple

  // Yellow gradient series
  static const Color yellow = Color(0xFFFFCC00); // iOS yellow
  static const Color yellow100 = Color(0xFFE6B800); // Dark yellow
  static const Color yellow90 = Color(0xFFF0C200); // Medium dark yellow
  static const Color yellow80 = Color(0xFFFACC00); // Medium yellow
  static const Color yellow70 = Color(0xFFFFD600); // Light medium yellow
  static const Color yellow60 = Color(0xFFFFE000); // Light yellow
  static const Color yellow50 = Color(0xFFFFEA00); // Very light yellow
  static const Color yellow40 = Color(0xFFFFF400); // Ultra light yellow
  static const Color yellow30 = Color(0xFFFFFE00); // Pale yellow
  static const Color yellow20 = Color(0xFFFFFE66); // Very pale yellow
  static const Color yellow10 = Color(0xFFFFFECC); // Almost white yellow

  // Pink gradient series
  static const Color pink = Color(0xFFFF2D92); // iOS pink
  static const Color pink100 = Color(0xFFE91E63); // Dark pink
  static const Color pink90 = Color(0xFFF06292); // Medium dark pink
  static const Color pink80 = Color(0xFFF48FB1); // Medium pink
  static const Color pink70 = Color(0xFFF8BBD0); // Light medium pink
  static const Color pink60 = Color(0xFFFCE4EC); // Light pink
  static const Color pink50 = Color(0xFFFFEBF0); // Very light pink
  static const Color pink40 = Color(0xFFFFF2F5); // Ultra light pink
  static const Color pink30 = Color(0xFFFFF9FA); // Pale pink
  static const Color pink20 = Color(0xFFFFFCFD); // Very pale pink
  static const Color pink10 = Color(0xFFFFFEFF); // Almost white pink

  // Teal gradient series
  static const Color teal = Color(0xFF5AC8FA); // iOS teal
  static const Color teal100 = Color(0xFF00ACC1); // Dark teal
  static const Color teal90 = Color(0xFF26C6DA); // Medium dark teal
  static const Color teal80 = Color(0xFF4DD0E1); // Medium teal
  static const Color teal70 = Color(0xFF73D9E8); // Light medium teal
  static const Color teal60 = Color(0xFF99E3EF); // Light teal
  static const Color teal50 = Color(0xFFBFEDF6); // Very light teal
  static const Color teal40 = Color(0xFFE5F7FD); // Ultra light teal
  static const Color teal30 = Color(0xFFF2FBFE); // Pale teal
  static const Color teal20 = Color(0xFFF9FDFF); // Very pale teal
  static const Color teal10 = Color(0xFFFCFEFF); // Almost white teal

  // Indigo gradient series
  static const Color indigo = Color(0xFF5856D6); // iOS indigo
  static const Color indigo100 = Color(0xFF3F51B5); // Dark indigo
  static const Color indigo90 = Color(0xFF5C6BC0); // Medium dark indigo
  static const Color indigo80 = Color(0xFF7986CB); // Medium indigo
  static const Color indigo70 = Color(0xFF9FA8DA); // Light medium indigo
  static const Color indigo60 = Color(0xFFC5CAE9); // Light indigo
  static const Color indigo50 = Color(0xFFE8EAF6); // Very light indigo
  static const Color indigo40 = Color(0xFFF3F4F9); // Ultra light indigo
  static const Color indigo30 = Color(0xFFF9F9FC); // Pale indigo
  static const Color indigo20 = Color(0xFFFCFCFE); // Very pale indigo
  static const Color indigo10 = Color(0xFFFEFEFF); // Almost white indigo

  // System colors
  static const Color systemBackground = Color(0xFFFFFFFF);
  static const Color systemBackgroundDark = Color(0xFF000000);
  static const Color secondarySystemBackground = Color(0xFFF2F2F7);
  static const Color secondarySystemBackgroundDark = Color(0xFF1C1C1E);
  static const Color tertiarySystemBackground = Color(0xFFFFFFFF);
  static const Color tertiarySystemBackgroundDark = Color(0xFF2C2C2E);

  // Label colors
  static const Color label = Color(0xFF000000);
  static const Color labelDark = Color(0xFFFFFFFF);
  static const Color secondaryLabel = Color(0x993C3C43);
  static const Color secondaryLabelDark = Color(0x99EBEBF5);
  static const Color tertiaryLabel = Color(0x4D3C3C43);
  static const Color tertiaryLabelDark = Color(0x4DEBEBF5);
  static const Color quaternaryLabel = Color(0x2E3C3C43);
  static const Color quaternaryLabelDark = Color(0x2EEBEBF5);

  // Separator colors
  static const Color separator = Color(0x493C3C43);
  static const Color separatorDark = Color(0x99545458);
  static const Color opaqueSeparator = Color(0xFFC6C6C8);
  static const Color opaqueSeparatorDark = Color(0xFF38383A);

  // Fill colors
  static const Color systemFill = Color(0x33787880);
  static const Color systemFillDark = Color(0x5C787880);
  static const Color secondarySystemFill = Color(0x28787880);
  static const Color secondarySystemFillDark = Color(0x51787880);
  static const Color tertiarySystemFill = Color(0x1E767680);
  static const Color tertiarySystemFillDark = Color(0x3D767680);
  static const Color quaternarySystemFill = Color(0x14747480);
  static const Color quaternarySystemFillDark = Color(0x2E747480);

  // Grouped background colors
  static const Color systemGroupedBackground = Color(0xFFF2F2F7);
  static const Color systemGroupedBackgroundDark = Color(0xFF000000);
  static const Color secondarySystemGroupedBackground = Color(0xFFFFFFFF);
  static const Color secondarySystemGroupedBackgroundDark = Color(0xFF1C1C1E);
  static const Color tertiarySystemGroupedBackground = Color(0xFFF2F2F7);
  static const Color tertiarySystemGroupedBackgroundDark = Color(0xFF2C2C2E);

  // Utility methods
  static Color withOpacity(Color color, double opacity) {
    return color.withOpacity(opacity);
  }

  static Color blend(Color color1, Color color2, double ratio) {
    return Color.lerp(color1, color2, ratio) ?? color1;
  }

  static List<Color> getGradientColors(Color baseColor) {
    // Generate gradient colors based on base color
    return [
      baseColor,
      baseColor.withOpacity(0.8),
      baseColor.withOpacity(0.6),
      baseColor.withOpacity(0.4),
      baseColor.withOpacity(0.2),
    ];
  }

  // These provide direct access to commonly used Flutter Colors.xxx values
  // to facilitate migration from hardcoded Flutter colors

  /// Transparent color (equivalent to Colors.transparent)
  static const Color transparent = Color(0x00000000);

  /// Common grey shades (equivalent to Colors.grey[xxx])
  static const Color grey50 = Color(0xFFFAFAFA);
  static const Color grey100 = Color(0xFFF5F5F5);
  static const Color grey200 = Color(0xFFEEEEEE);
  static const Color grey300 = Color(0xFFE0E0E0);
  static const Color grey400 = Color(0xFFBDBDBD);
  static const Color grey500 = Color(0xFF9E9E9E);
  static const Color grey600 = Color(0xFF757575);
  static const Color grey700 = Color(0xFF616161);
  static const Color grey800 = Color(0xFF424242);
  static const Color grey850 = Color(0xFF303030);
  static const Color grey900 = Color(0xFF212121);

  // Additional commonly used colors
  static const Color black87 = Color(0xDD000000); // 87% opacity black
  static const Color brown = Color(0xFF8D6E63); // Material brown
  static const Color brown50 = Color(0xFFEFEBE9);
  static const Color brown100 = Color(0xFFD7CCC8);
  static const Color brown200 = Color(0xFFBCAAA4);
  static const Color brown300 = Color(0xFFA1887F);
  static const Color brown400 = Color(0xFF8D6E63);
  static const Color brown500 = Color(0xFF795548);
  static const Color brown600 = Color(0xFF6D4C41);
  static const Color brown700 = Color(0xFF5D4037);
  static const Color brown800 = Color(0xFF4E342E);
  static const Color brown900 = Color(0xFF3E2723);

  // These provide semantic meaning to colors for better code readability

  /// Surface colors for different themes
  static const Color lightSurface = white;
  static const Color darkSurface = black80;
  static const Color lightBackground = systemBackground;
  static const Color darkBackground = systemBackgroundDark;

  /// Common UI element colors
  static const Color dividerColor = grey300;
  static const Color borderColor = grey300;
  static const Color shadowColor = Color(0x1A000000);
  static const Color overlayColor = Color(0x80000000);

  // Common aliases used in app_wuy and other apps
  static const Color primary = blue;
  static const Color primaryColor = blue;
  static const Color primaryDark = blue100;
  static const Color textSecondary = secondaryLabel;
  static const Color textPrimary = label;
  static const Color surfaceVariant = grey100;
  static const Color secondaryColor = green;
  static const Color error = red;
  static const Color success = green;
  static const Color warning = orange;
  static const Color info = blue;
  static const Color greyColor = grey500;

  static const Color primaryLight = blue10;

  // Color scheme generators
  static ColorScheme lightColorScheme = const ColorScheme.light(
    primary: blue,
    secondary: green,
    surface: lightSurface,
    background: lightBackground,
    error: red,
    onPrimary: white,
    onSecondary: white,
    onSurface: black,
    onBackground: black,
    onError: white,
  );

  static ColorScheme darkColorScheme = const ColorScheme.dark(
    primary: blue60,
    secondary: green60,
    surface: darkSurface,
    background: darkBackground,
    error: red60,
    onPrimary: black,
    onSecondary: black,
    onSurface: white,
    onBackground: white,
    onError: black,
  );

  // Common brand colors that can be used across different apps

  /// Primary brand color - commonly used green
  static const Color primaryBrand = Color(0xFF0B9722);

  /// Generates a consistent color based on a string input
  /// The same string will always generate the same color
  static Color getStringColor(String input, {bool isDark = false}) {
    int hash = input.codeUnits.fold(0, (prev, curr) => prev + curr * 17);
    double hue = (hash % 360).toDouble();

    return HSLColor.fromAHSL(
      1.0,
      hue,
      isDark ? 0.3 : 0.7,
      isDark ? 0.2 : 0.9,
    ).toColor();
  }

  /// Generates a consistent gradient background for a given string
  /// The same string will always generate the same gradient colors
  static LinearGradient getStringGradient(String input, {bool isDark = false}) {
    // Generate a consistent hash from the string
    int hash = input.codeUnits.fold(0, (prev, curr) => prev + curr * 17);

    // Use the hash to generate two different hue values
    double hue1 = (hash % 360).toDouble();
    double hue2 = ((hash * 13) % 360).toDouble();

    // Create two colors with different hues but consistent saturation and brightness
    Color color1 = HSLColor.fromAHSL(
      1.0,
      hue1,
      isDark ? 0.3 : 0.7, // Lower saturation for dark mode
      isDark ? 0.2 : 0.9, // Lower lightness for dark mode
    ).toColor();

    Color color2 = HSLColor.fromAHSL(
      1.0,
      hue2,
      isDark ? 0.3 : 0.6, // Slightly different saturation for variety
      isDark ? 0.3 : 0.8, // Slightly different lightness for variety
    ).toColor();

    // Create a gradient with these colors
    return LinearGradient(
      colors: [color1, color2],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  }
}
