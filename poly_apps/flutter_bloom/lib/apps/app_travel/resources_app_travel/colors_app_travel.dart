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

class TravelColors {
  // Primary Theme Colors
  static const Color travelPrimary = Color(0xFF00D0D8);
  static const Color travelPrimaryLight = Color(0xFFE3F2FD);

  // Background Colors
  static const Color travelBackground = Color(0xFFF5F5F5);
  static const Color travelBackgroundDark = Color(0xFF2C2C2C);
  static const Color travelSurface = ThemeColors.white;
  static const Color travelSurfaceLight = Color(0xFFF8F8F8);

  // Border and Divider Colors
  static const Color travelBorder = Color(0xFFEEEEEE);
  static const Color travelBorderLight = Color(0xFFE0E0E0);
  static const Color travelDivider = Color(0xFFD9D9D9);
  static const Color travelDividerDark = Color(0xFFCCCCCC);

  // Text Colors
  static const Color travelTextPrimary = ThemeColors.black87;
  static const Color travelTextSecondary = Color(0xFF666666);
  static const Color travelTextTertiary = Color(0xFF999999);
  static const Color travelTextLight = ThemeColors.white;

  // Accent Colors
  static const Color travelAccentOrange = Color(0xFFFF9A56);
  static const Color travelAccentOrangeDark = Color(0xFFFF7A3D);
  static const Color travelAccentRed = Color(0xFFFF6B35);
  static const Color travelAccentRedBright = Color(0xFFFF3838);
  static const Color travelAccentRedDanger = Color(0xFFFF3B30);
  static const Color travelAccentOrangeLight = Color(0xFFFF9F33);
  static const Color travelAccentYellow = Color(0xFFFFC107);
  static const Color travelAccentYellowBright = Color(0xFFFFF500);

  // Purple Accent Colors
  static const Color travelAccentPurple = Color(0xFF9C9FDE);
  static const Color travelAccentPurpleDark = Color(0xFF9C27B0);
  static const Color travelAccentPurpleLight = Color(0xFFE040FB);

  // Blue Accent Colors
  static const Color travelAccentBlue = Color(0xFF0086F6);
  static const Color travelAccentBlueLight = Color(0xFFEBF5FF);
  static const Color travelAccentBlueMedium = Color(0xFF4DA0E8);
  static const Color travelAccentBlueSky = Color(0xFF87CEEB);

  // Green Accent Colors
  static const Color travelAccentGreenDark = Color(0xFF2C5F2D);
  static const Color travelAccentGreenMedium = Color(0xFF4A9F7C);
  static const Color travelAccentGreenLight = Color(0xFF6AB593);
  static const Color travelAccentTeal = Color(0xFF34C2AA);
  static const Color travelAccentLime = Color(0xFF6CD557);

  // Status Colors
  static const Color travelSuccess = ThemeColors.green;
  static const Color travelWarning = Color(0xFFFFF8F0);
  static const Color travelError = ThemeColors.red;
  static const Color travelInfo = ThemeColors.blue;

  // Special Colors
  static const Color travelHighlight = Color(0xFFA05416);
  static const Color travelRank1 = Color(0xFFFF3838);
  static const Color travelRank2 = Color(0xFFFF9F33);
  static const Color travelRankDefault = Color(0xFF666666);
  static const Color travelStar = Color(0xFFFF6600);
  static const Color travelBadge = Color(0xFFFF6B35);

  // Gradient Colors - Red to Orange
  static const List<Color> travelGradientRedOrange = [
    Color(0xFFFA5956),
    Color(0xFFFB8650),
  ];

  // Gradient Colors - Blue
  static const List<Color> travelGradientBlue = [
    Color(0xFF4B8FED),
    Color(0xFF53BCED),
  ];

  // Gradient Colors - Teal to Lime
  static const List<Color> travelGradientTealLime = [
    Color(0xFF34C2AA),
    Color(0xFF6CD557),
  ];

  // Gradient Colors - Yellow
  static const List<Color> travelGradientYellow = [
    Color(0xFFFFBC49),
    Color(0xFFFFD252),
  ];

  // Gradient Colors - Orange
  static const List<Color> travelGradientOrange = [
    Color(0xFFFF9A56),
    Color(0xFFFF7A3D),
  ];

  // Gradient Colors - Light Blue
  static const List<Color> travelGradientLightBlue = [
    Color(0xFF9DD8F2),
    Color(0xFFB8E3F8),
  ];

  // Gradient Colors - Purple
  static const List<Color> travelGradientPurple = [
    Color(0xFF9C27B0),
    Color(0xFFE040FB),
  ];

  // Gradient Colors - Sky Blue
  static const List<Color> travelGradientSkyBlue = [
    Color(0xFF4DA0E8),
    Color(0xFF87CEEB),
  ];

  // Shadow Colors
  static const Color travelShadowLight = Color(0x1A000000);
  static const Color travelShadowMedium = Color(0x33000000);

  // Opacity Colors
  static Color travelPrimaryWithOpacity(double opacity) {
    return travelPrimary.withOpacity(opacity);
  }

  static Color travelBackgroundDarkWithOpacity(double opacity) {
    return travelBackgroundDark.withOpacity(opacity);
  }

  // Utility methods
  static LinearGradient createGradient(List<Color> colors, {
    AlignmentGeometry begin = Alignment.topLeft,
    AlignmentGeometry end = Alignment.bottomRight,
  }) {
    return LinearGradient(
      colors: colors,
      begin: begin,
      end: end,
    );
  }

  static BoxShadow createBoxShadow({
    Color color = travelShadowLight,
    double blurRadius = 8.0,
    Offset offset = const Offset(0, 2.0),
  }) {
    return BoxShadow(
      color: color,
      blurRadius: blurRadius,
      offset: offset,
    );
  }
}
