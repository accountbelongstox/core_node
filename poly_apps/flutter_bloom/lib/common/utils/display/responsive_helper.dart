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

// Migrated from lib/helper/responsive_helper.dart
// This file provides responsive design utilities for the application

import 'package:flutter/material.dart';

class ResponsiveHelper {
  // Breakpoints for responsive design
  static const double mobileBreakpoint = 600;
  static const double tabletBreakpoint = 1024;
  static const double desktopBreakpoint = 1440;

  // Static variables for caching screen info
  static bool _isMobile = false;
  static bool _isTablet = false;
  static bool _isDesktop = false;
  static bool _isPortrait = false;
  static double _screenWidth = 0;
  static double _screenHeight = 0;

  /// Refresh screen information (for backward compatibility)
  static void refresh(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    _screenWidth = mediaQuery.size.width;
    _screenHeight = mediaQuery.size.height;
    _isPortrait = mediaQuery.orientation == Orientation.portrait;
    _isMobile = _screenWidth < mobileBreakpoint;
    _isTablet = _screenWidth >= mobileBreakpoint && _screenWidth < tabletBreakpoint;
    _isDesktop = _screenWidth >= tabletBreakpoint;
  }

  /// Check if current screen is mobile
  static bool isMobile(BuildContext context) {
    return MediaQuery.of(context).size.width < mobileBreakpoint;
  }

  /// Check if current screen is tablet
  static bool isTablet(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return width >= mobileBreakpoint && width < tabletBreakpoint;
  }

  /// Check if current screen is desktop
  static bool isDesktop(BuildContext context) {
    return MediaQuery.of(context).size.width >= tabletBreakpoint;
  }

  /// Get current device type
  static DeviceType getDeviceType(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < mobileBreakpoint) {
      return DeviceType.mobile;
    } else if (width < tabletBreakpoint) {
      return DeviceType.tablet;
    } else {
      return DeviceType.desktop;
    }
  }

  /// Get responsive value based on device type
  static T responsive<T>(
    BuildContext context, {
    required T mobile,
    T? tablet,
    T? desktop,
  }) {
    final deviceType = getDeviceType(context);
    switch (deviceType) {
      case DeviceType.mobile:
        return mobile;
      case DeviceType.tablet:
        return tablet ?? mobile;
      case DeviceType.desktop:
        return desktop ?? tablet ?? mobile;
    }
  }

  /// Get responsive widget based on device type
  static Widget responsiveWidget(
    BuildContext context, {
    required Widget mobile,
    Widget? tablet,
    Widget? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile,
      tablet: tablet,
      desktop: desktop,
    );
  }

  /// Get responsive padding
  static EdgeInsets responsivePadding(
    BuildContext context, {
    EdgeInsets? mobile,
    EdgeInsets? tablet,
    EdgeInsets? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? const EdgeInsets.all(16),
      tablet: tablet ?? const EdgeInsets.all(24),
      desktop: desktop ?? const EdgeInsets.all(32),
    );
  }

  /// Get responsive margin
  static EdgeInsets responsiveMargin(
    BuildContext context, {
    EdgeInsets? mobile,
    EdgeInsets? tablet,
    EdgeInsets? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? const EdgeInsets.all(8),
      tablet: tablet ?? const EdgeInsets.all(12),
      desktop: desktop ?? const EdgeInsets.all(16),
    );
  }

  /// Get responsive font size
  static double responsiveFontSize(
    BuildContext context,
    double baseFontSize, {
    double? mobileScale,
    double? tabletScale,
    double? desktopScale,
  }) {
    return responsive(
      context,
      mobile: baseFontSize * (mobileScale ?? 1.0),
      tablet: baseFontSize * (tabletScale ?? 1.1),
      desktop: baseFontSize * (desktopScale ?? 1.2),
    );
  }

  /// Get responsive icon size
  static double responsiveIconSize(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 24,
      tablet: tablet ?? 28,
      desktop: desktop ?? 32,
    );
  }

  /// Get responsive button size
  static Size responsiveButtonSize(
    BuildContext context, {
    Size? mobile,
    Size? tablet,
    Size? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? const Size(double.infinity, 48),
      tablet: tablet ?? const Size(double.infinity, 52),
      desktop: desktop ?? const Size(double.infinity, 56),
    );
  }

  /// Get responsive border radius
  static double responsiveBorderRadius(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 8,
      tablet: tablet ?? 12,
      desktop: desktop ?? 16,
    );
  }

  /// Get responsive elevation
  static double responsiveElevation(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 2,
      tablet: tablet ?? 4,
      desktop: desktop ?? 6,
    );
  }

  /// Get responsive grid columns
  static int responsiveGridColumns(
    BuildContext context, {
    int? mobile,
    int? tablet,
    int? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 1,
      tablet: tablet ?? 2,
      desktop: desktop ?? 3,
    );
  }

  /// Get responsive grid aspect ratio
  static double responsiveGridAspectRatio(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 1.0,
      tablet: tablet ?? 1.2,
      desktop: desktop ?? 1.5,
    );
  }

  /// Get responsive container width
  static double responsiveContainerWidth(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    final screenWidth = MediaQuery.of(context).size.width;
    return responsive(
      context,
      mobile: mobile ?? screenWidth * 0.9,
      tablet: tablet ?? screenWidth * 0.8,
      desktop: desktop ?? screenWidth * 0.7,
    );
  }

  /// Get responsive max width
  static double responsiveMaxWidth(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 400,
      tablet: tablet ?? 600,
      desktop: desktop ?? 800,
    );
  }

  /// Get responsive spacing
  static double responsiveSpacing(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 8,
      tablet: tablet ?? 12,
      desktop: desktop ?? 16,
    );
  }

  /// Get responsive app bar height
  static double responsiveAppBarHeight(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? kToolbarHeight,
      tablet: tablet ?? kToolbarHeight + 8,
      desktop: desktop ?? kToolbarHeight + 16,
    );
  }

  /// Get responsive drawer width
  static double responsiveDrawerWidth(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    final screenWidth = MediaQuery.of(context).size.width;
    return responsive(
      context,
      mobile: mobile ?? screenWidth * 0.8,
      tablet: tablet ?? 320,
      desktop: desktop ?? 360,
    );
  }

  /// Get responsive dialog width
  static double responsiveDialogWidth(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    final screenWidth = MediaQuery.of(context).size.width;
    return responsive(
      context,
      mobile: mobile ?? screenWidth * 0.9,
      tablet: tablet ?? 400,
      desktop: desktop ?? 500,
    );
  }

  /// Get responsive card width
  static double responsiveCardWidth(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    final screenWidth = MediaQuery.of(context).size.width;
    return responsive(
      context,
      mobile: mobile ?? screenWidth - 32,
      tablet: tablet ?? 300,
      desktop: desktop ?? 350,
    );
  }

  /// Get responsive list tile height
  static double responsiveListTileHeight(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 56,
      tablet: tablet ?? 64,
      desktop: desktop ?? 72,
    );
  }

  /// Get responsive text style
  static TextStyle responsiveTextStyle(
    BuildContext context,
    TextStyle baseStyle, {
    double? mobileScale,
    double? tabletScale,
    double? desktopScale,
  }) {
    final fontSize = baseStyle.fontSize ?? 14;
    final responsiveFontSize = responsive(
      context,
      mobile: fontSize * (mobileScale ?? 1.0),
      tablet: fontSize * (tabletScale ?? 1.1),
      desktop: fontSize * (desktopScale ?? 1.2),
    );
    
    return baseStyle.copyWith(fontSize: responsiveFontSize);
  }

  /// Create responsive layout
  static Widget responsiveLayout(
    BuildContext context, {
    required Widget mobile,
    Widget? tablet,
    Widget? desktop,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < mobileBreakpoint) {
          return mobile;
        } else if (constraints.maxWidth < tabletBreakpoint) {
          return tablet ?? mobile;
        } else {
          return desktop ?? tablet ?? mobile;
        }
      },
    );
  }

  /// Get responsive flex values
  static List<int> responsiveFlexValues(
    BuildContext context, {
    required List<int> mobile,
    List<int>? tablet,
    List<int>? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile,
      tablet: tablet ?? mobile,
      desktop: desktop ?? tablet ?? mobile,
    );
  }

  /// Get responsive cross axis count for grid
  static int responsiveCrossAxisCount(
    BuildContext context, {
    int? mobile,
    int? tablet,
    int? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 2,
      tablet: tablet ?? 3,
      desktop: desktop ?? 4,
    );
  }

  /// Get responsive main axis spacing for grid
  static double responsiveMainAxisSpacing(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 8,
      tablet: tablet ?? 12,
      desktop: desktop ?? 16,
    );
  }

  /// Get responsive cross axis spacing for grid
  static double responsiveCrossAxisSpacing(
    BuildContext context, {
    double? mobile,
    double? tablet,
    double? desktop,
  }) {
    return responsive(
      context,
      mobile: mobile ?? 8,
      tablet: tablet ?? 12,
      desktop: desktop ?? 16,
    );
  }
}

/// Enum for device types
enum DeviceType {
  mobile,
  tablet,
  desktop,
}
