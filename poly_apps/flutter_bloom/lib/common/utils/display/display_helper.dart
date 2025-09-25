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

// Migrated from lib/helper/display_helper.dart
// This file provides display utilities for the application

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DisplayHelper {
  /// Get screen size
  static Size getScreenSize(BuildContext context) {
    return MediaQuery.of(context).size;
  }

  /// Get screen width
  static double getScreenWidth(BuildContext context) {
    return MediaQuery.of(context).size.width;
  }

  /// Get screen height
  static double getScreenHeight(BuildContext context) {
    return MediaQuery.of(context).size.height;
  }

  /// Get device pixel ratio
  static double getPixelRatio(BuildContext context) {
    return MediaQuery.of(context).devicePixelRatio;
  }

  /// Get status bar height
  static double getStatusBarHeight(BuildContext context) {
    return MediaQuery.of(context).padding.top;
  }

  /// Get bottom padding (safe area)
  static double getBottomPadding(BuildContext context) {
    return MediaQuery.of(context).padding.bottom;
  }

  /// Get safe area padding
  static EdgeInsets getSafeAreaPadding(BuildContext context) {
    return MediaQuery.of(context).padding;
  }

  /// Check if device is in landscape mode
  static bool isLandscape(BuildContext context) {
    return MediaQuery.of(context).orientation == Orientation.landscape;
  }

  /// Check if device is in portrait mode
  static bool isPortrait(BuildContext context) {
    return MediaQuery.of(context).orientation == Orientation.portrait;
  }

  /// Get orientation
  static Orientation getOrientation(BuildContext context) {
    return MediaQuery.of(context).orientation;
  }

  /// Check if device is tablet
  static bool isTablet(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final diagonal = (size.width * size.width + size.height * size.height);
    return diagonal > 1100000; // Roughly 7 inches
  }

  /// Check if device is phone
  static bool isPhone(BuildContext context) {
    return !isTablet(context);
  }

  /// Get device type
  static DisplayDeviceType getDeviceType(BuildContext context) {
    if (isTablet(context)) {
      return DisplayDeviceType.tablet;
    } else {
      return DisplayDeviceType.phone;
    }
  }

  /// Check if screen is small
  static bool isSmallScreen(BuildContext context) {
    return getScreenWidth(context) < 600;
  }

  /// Check if screen is medium
  static bool isMediumScreen(BuildContext context) {
    final width = getScreenWidth(context);
    return width >= 600 && width < 1200;
  }

  /// Check if screen is large
  static bool isLargeScreen(BuildContext context) {
    return getScreenWidth(context) >= 1200;
  }

  /// Get screen size category
  static ScreenSize getScreenSizeCategory(BuildContext context) {
    final width = getScreenWidth(context);
    if (width < 600) {
      return ScreenSize.small;
    } else if (width < 1200) {
      return ScreenSize.medium;
    } else {
      return ScreenSize.large;
    }
  }

  /// Get responsive value based on screen size
  static T getResponsiveValue<T>(
    BuildContext context, {
    required T small,
    T? medium,
    T? large,
  }) {
    final screenSize = getScreenSizeCategory(context);
    switch (screenSize) {
      case ScreenSize.small:
        return small;
      case ScreenSize.medium:
        return medium ?? small;
      case ScreenSize.large:
        return large ?? medium ?? small;
    }
  }

  /// Get responsive padding
  static EdgeInsets getResponsivePadding(BuildContext context) {
    return getResponsiveValue(
      context,
      small: const EdgeInsets.all(16.0),
      medium: const EdgeInsets.all(24.0),
      large: const EdgeInsets.all(32.0),
    );
  }

  /// Get responsive margin
  static EdgeInsets getResponsiveMargin(BuildContext context) {
    return getResponsiveValue(
      context,
      small: const EdgeInsets.all(8.0),
      medium: const EdgeInsets.all(12.0),
      large: const EdgeInsets.all(16.0),
    );
  }

  /// Get responsive font size
  static double getResponsiveFontSize(
    BuildContext context, {
    required double baseSize,
  }) {
    return getResponsiveValue(
      context,
      small: baseSize,
      medium: baseSize * 1.1,
      large: baseSize * 1.2,
    );
  }

  /// Get responsive icon size
  static double getResponsiveIconSize(BuildContext context) {
    return getResponsiveValue(
      context,
      small: 24.0,
      medium: 28.0,
      large: 32.0,
    );
  }

  /// Get responsive button height
  static double getResponsiveButtonHeight(BuildContext context) {
    return getResponsiveValue(
      context,
      small: 48.0,
      medium: 52.0,
      large: 56.0,
    );
  }

  /// Get responsive border radius
  static double getResponsiveBorderRadius(BuildContext context) {
    return getResponsiveValue(
      context,
      small: 8.0,
      medium: 12.0,
      large: 16.0,
    );
  }

  /// Get responsive elevation
  static double getResponsiveElevation(BuildContext context) {
    return getResponsiveValue(
      context,
      small: 2.0,
      medium: 4.0,
      large: 6.0,
    );
  }

  /// Get responsive grid columns
  static int getResponsiveGridColumns(BuildContext context) {
    return getResponsiveValue(
      context,
      small: 2,
      medium: 3,
      large: 4,
    );
  }

  /// Get responsive list tile height
  static double getResponsiveListTileHeight(BuildContext context) {
    return getResponsiveValue(
      context,
      small: 56.0,
      medium: 64.0,
      large: 72.0,
    );
  }

  /// Set preferred orientations
  static Future<void> setPreferredOrientations(
    List<DeviceOrientation> orientations,
  ) async {
    await SystemChrome.setPreferredOrientations(orientations);
  }

  /// Lock to portrait
  static Future<void> lockToPortrait() async {
    await setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  }

  /// Lock to landscape
  static Future<void> lockToLandscape() async {
    await setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  }

  /// Allow all orientations
  static Future<void> allowAllOrientations() async {
    await setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  }

  /// Hide status bar
  static Future<void> hideStatusBar() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.manual, overlays: []);
  }

  /// Show status bar
  static Future<void> showStatusBar() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.manual, 
        overlays: SystemUiOverlay.values);
  }

  /// Set status bar style
  static void setStatusBarStyle({
    Brightness? statusBarBrightness,
    Brightness? statusBarIconBrightness,
    Color? statusBarColor,
  }) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
      statusBarBrightness: statusBarBrightness,
      statusBarIconBrightness: statusBarIconBrightness,
      statusBarColor: statusBarColor,
    ));
  }

  /// Get text scale factor
  static double getTextScaleFactor(BuildContext context) {
    return MediaQuery.of(context).textScaleFactor;
  }

  /// Get brightness
  static Brightness getBrightness(BuildContext context) {
    return MediaQuery.of(context).platformBrightness;
  }

  /// Check if dark mode
  static bool isDarkMode(BuildContext context) {
    return getBrightness(context) == Brightness.dark;
  }

  /// Check if light mode
  static bool isLightMode(BuildContext context) {
    return getBrightness(context) == Brightness.light;
  }

  /// Get view insets (keyboard height)
  static EdgeInsets getViewInsets(BuildContext context) {
    return MediaQuery.of(context).viewInsets;
  }

  /// Check if keyboard is visible
  static bool isKeyboardVisible(BuildContext context) {
    return getViewInsets(context).bottom > 0;
  }

  /// Get keyboard height
  static double getKeyboardHeight(BuildContext context) {
    return getViewInsets(context).bottom;
  }
}

/// Enum for device types
enum DisplayDeviceType {
  phone,
  tablet,
}

/// Enum for screen sizes
enum ScreenSize {
  small,
  medium,
  large,
}
