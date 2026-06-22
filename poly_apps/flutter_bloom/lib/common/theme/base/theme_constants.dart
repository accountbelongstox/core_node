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

class ThemeConstants {
  // Theme mode constants
  static const String themeModeLight = 'light';
  static const String themeModeDark = 'dark';
  static const String themeModeSystem = 'system';

  // Platform constants
  static const String platformMobile = 'mobile';
  static const String platformWeb = 'web';
  static const String platformDesktop = 'desktop';

  // Theme storage keys
  static const String themeStorageKey = 'app_theme_mode';
  static const String platformThemeStorageKey = 'app_platform_theme';
  static const String customThemeStorageKey = 'app_custom_theme';

  // Animation constants
  static const Duration defaultAnimationDuration = Duration(milliseconds: 300);
  static const Duration fastAnimationDuration = Duration(milliseconds: 150);
  static const Duration slowAnimationDuration = Duration(milliseconds: 500);

  // Theme transition constants
  static const Duration themeTransitionDuration = Duration(milliseconds: 300);
  static const Curve themeTransitionCurve = Curves.easeInOut;

  // Elevation constants
  static const double elevationNone = 0.0;
  static const double elevationLow = 1.0;
  static const double elevationMedium = 4.0;
  static const double elevationHigh = 8.0;
  static const double elevationVeryHigh = 16.0;

  // Opacity constants
  static const double opacityDisabled = 0.38;
  static const double opacityMedium = 0.54;
  static const double opacityHigh = 0.87;
  static const double opacityFull = 1.0;

  // Border width constants
  static const double borderWidthThin = 0.5;
  static const double borderWidthNormal = 1.0;
  static const double borderWidthThick = 2.0;
  static const double borderWidthVeryThick = 4.0;

  // Shadow constants
  static const List<BoxShadow> shadowLow = [
    BoxShadow(
      color: Color(0x1F000000),
      offset: Offset(0, 1),
      blurRadius: 3,
      spreadRadius: 0,
    ),
  ];

  static const List<BoxShadow> shadowMedium = [
    BoxShadow(
      color: Color(0x24000000),
      offset: Offset(0, 2),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  static const List<BoxShadow> shadowHigh = [
    BoxShadow(
      color: Color(0x29000000),
      offset: Offset(0, 4),
      blurRadius: 12,
      spreadRadius: 0,
    ),
  ];

  static const List<BoxShadow> shadowVeryHigh = [
    BoxShadow(
      color: Color(0x33000000),
      offset: Offset(0, 8),
      blurRadius: 24,
      spreadRadius: 0,
    ),
  ];

  // Blur constants
  static const double blurNone = 0.0;
  static const double blurLight = 5.0;
  static const double blurMedium = 10.0;
  static const double blurHeavy = 20.0;

  // Z-index constants
  static const int zIndexBackground = 0;
  static const int zIndexContent = 1;
  static const int zIndexOverlay = 10;
  static const int zIndexModal = 100;
  static const int zIndexTooltip = 1000;
  static const int zIndexDropdown = 1001;
  static const int zIndexToast = 1002;

  // Breakpoint constants
  static const Map<String, double> breakpoints = {
    'xs': 0,
    'sm': 576,
    'md': 768,
    'lg': 992,
    'xl': 1200,
    'xxl': 1400,
  };

  // Grid constants
  static const int gridColumnsXS = 1;
  static const int gridColumnsSM = 2;
  static const int gridColumnsMD = 3;
  static const int gridColumnsLG = 4;
  static const int gridColumnsXL = 6;

  // Aspect ratio constants
  static const double aspectRatioSquare = 1.0;
  static const double aspectRatioLandscape = 16.0 / 9.0;
  static const double aspectRatioPortrait = 9.0 / 16.0;
  static const double aspectRatioGolden = 1.618;

  // Theme configuration
  static const Map<String, dynamic> defaultThemeConfig = {
    'useMaterial3': true,
    'useSystemTheme': true,
    'adaptiveTheme': true,
    'highContrast': false,
    'reducedMotion': false,
  };

  // Color scheme variants
  static const List<String> colorSchemeVariants = [
    'default',
    'monochrome',
    'analogous',
    'complementary',
    'triadic',
    'tetradic',
  ];

  // Font weight mapping
  static const Map<String, FontWeight> fontWeights = {
    'thin': FontWeight.w100,
    'extraLight': FontWeight.w200,
    'light': FontWeight.w300,
    'normal': FontWeight.w400,
    'medium': FontWeight.w500,
    'semiBold': FontWeight.w600,
    'bold': FontWeight.w700,
    'extraBold': FontWeight.w800,
    'black': FontWeight.w900,
  };

  // Text decoration constants
  static const TextDecoration textDecorationNone = TextDecoration.none;
  static const TextDecoration textDecorationUnderline = TextDecoration.underline;
  static const TextDecoration textDecorationOverline = TextDecoration.overline;
  static const TextDecoration textDecorationLineThrough = TextDecoration.lineThrough;

  // Text align constants
  static const TextAlign textAlignLeft = TextAlign.left;
  static const TextAlign textAlignCenter = TextAlign.center;
  static const TextAlign textAlignRight = TextAlign.right;
  static const TextAlign textAlignJustify = TextAlign.justify;

  // Flex constants
  static const MainAxisAlignment mainAxisAlignmentStart = MainAxisAlignment.start;
  static const MainAxisAlignment mainAxisAlignmentCenter = MainAxisAlignment.center;
  static const MainAxisAlignment mainAxisAlignmentEnd = MainAxisAlignment.end;
  static const MainAxisAlignment mainAxisAlignmentSpaceBetween = MainAxisAlignment.spaceBetween;
  static const MainAxisAlignment mainAxisAlignmentSpaceAround = MainAxisAlignment.spaceAround;
  static const MainAxisAlignment mainAxisAlignmentSpaceEvenly = MainAxisAlignment.spaceEvenly;

  static const CrossAxisAlignment crossAxisAlignmentStart = CrossAxisAlignment.start;
  static const CrossAxisAlignment crossAxisAlignmentCenter = CrossAxisAlignment.center;
  static const CrossAxisAlignment crossAxisAlignmentEnd = CrossAxisAlignment.end;
  static const CrossAxisAlignment crossAxisAlignmentStretch = CrossAxisAlignment.stretch;

  // Input decoration constants
  static const InputBorder inputBorderNone = InputBorder.none;
  static const OutlineInputBorder inputBorderOutline = OutlineInputBorder();
  static const UnderlineInputBorder inputBorderUnderline = UnderlineInputBorder();

  // Scroll physics constants
  static const ScrollPhysics scrollPhysicsDefault = AlwaysScrollableScrollPhysics();
  static const ScrollPhysics scrollPhysicsNever = NeverScrollableScrollPhysics();
  static const ScrollPhysics scrollPhysicsBouncingIOS = BouncingScrollPhysics();
  static const ScrollPhysics scrollPhysicsClampingAndroid = ClampingScrollPhysics();

  // Clip behavior constants
  static const Clip clipNone = Clip.none;
  static const Clip clipHardEdge = Clip.hardEdge;
  static const Clip clipAntiAlias = Clip.antiAlias;
  static const Clip clipAntiAliasWithSaveLayer = Clip.antiAliasWithSaveLayer;

  // Overflow constants
  static const TextOverflow textOverflowClip = TextOverflow.clip;
  static const TextOverflow textOverflowEllipsis = TextOverflow.ellipsis;
  static const TextOverflow textOverflowFade = TextOverflow.fade;
  static const TextOverflow textOverflowVisible = TextOverflow.visible;

  // Image fit constants
  static const BoxFit imageFitFill = BoxFit.fill;
  static const BoxFit imageFitContain = BoxFit.contain;
  static const BoxFit imageFitCover = BoxFit.cover;
  static const BoxFit imageFitFitWidth = BoxFit.fitWidth;
  static const BoxFit imageFitFitHeight = BoxFit.fitHeight;
  static const BoxFit imageFitNone = BoxFit.none;
  static const BoxFit imageFitScaleDown = BoxFit.scaleDown;

  // Utility methods
  static FontWeight getFontWeight(String weight) {
    return fontWeights[weight] ?? FontWeight.normal;
  }

  static double getBreakpoint(String size) {
    return breakpoints[size] ?? 0.0;
  }

  static int getGridColumns(double screenWidth) {
    if (screenWidth >= breakpoints['xl']!) return gridColumnsXL;
    if (screenWidth >= breakpoints['lg']!) return gridColumnsLG;
    if (screenWidth >= breakpoints['md']!) return gridColumnsMD;
    if (screenWidth >= breakpoints['sm']!) return gridColumnsSM;
    return gridColumnsXS;
  }

  static List<BoxShadow> getShadow(String level) {
    switch (level.toLowerCase()) {
      case 'low':
        return shadowLow;
      case 'medium':
        return shadowMedium;
      case 'high':
        return shadowHigh;
      case 'very_high':
        return shadowVeryHigh;
      default:
        return shadowMedium;
    }
  }

  static Duration getAnimationDuration(String speed) {
    switch (speed.toLowerCase()) {
      case 'fast':
        return fastAnimationDuration;
      case 'slow':
        return slowAnimationDuration;
      default:
        return defaultAnimationDuration;
    }
  }

  // Theme validation
  static bool isValidThemeMode(String mode) {
    return [themeModeLight, themeModeDark, themeModeSystem].contains(mode);
  }

  static bool isValidPlatform(String platform) {
    return [platformMobile, platformWeb, platformDesktop].contains(platform);
  }

  // Default values
  static const String defaultThemeMode = themeModeSystem;
  static const String defaultPlatform = platformMobile;
  static const bool defaultUseMaterial3 = true;
  static const bool defaultUseSystemTheme = true;
}
