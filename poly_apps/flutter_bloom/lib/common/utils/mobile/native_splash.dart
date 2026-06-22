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

// Migrated from lib/helper/native_splash.dart
// This file provides native splash screen utilities for the application

import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';

class NativeSplashHelper {
  /// Preserve the native splash screen until initialization is complete
  /// Now supports both mobile and web platforms
  static void preserve({required WidgetsBinding widgetsBinding}) {
    // flutter_native_splash now supports web platform
    FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);
  }

  /// Remove the native splash screen after initialization
  /// Works on both mobile and web platforms
  static void remove() {
    try {
      FlutterNativeSplash.remove();
    } catch (e) {
      // Log error but don't crash the app
      debugPrint('Splash screen removal error: $e');
    }
  }

  /// Create a custom splash screen widget
  static Widget createSplashScreen({
    Widget? child,
    Color? backgroundColor,
    String? imagePath,
    double? imageWidth,
    double? imageHeight,
    Duration? duration,
  }) {
    return Container(
      color: backgroundColor ?? Colors.white,
      child: Center(
        child: child ??
            (imagePath != null
                ? Image.asset(
                    imagePath,
                    width: imageWidth ?? 200,
                    height: imageHeight ?? 200,
                  )
                : const CircularProgressIndicator()),
      ),
    );
  }

  /// Show splash screen for a specific duration
  static Future<void> showForDuration(Duration duration) async {
    await Future.delayed(duration);
    remove();
  }

  /// Check if splash screen is currently showing
  static bool get isShowing {
    // Since flutter_native_splash now supports web, we can use a simple approach
    // In a real implementation, you might want to track this state more precisely
    return true; // Placeholder implementation
  }
}
