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
import 'package:flutter/foundation.dart' show kIsWeb;
import 'platforms/mobile/mobile_light_theme.dart';
import 'platforms/mobile/mobile_dark_theme.dart';
import 'platforms/web/web_light_theme.dart';
import 'platforms/web/web_dark_theme.dart';
import 'platforms/desktop/desktop_light_theme.dart';
import 'platforms/desktop/desktop_dark_theme.dart';
import 'extensions/gradient_extensions.dart';

/// Theme manager that provides unified theme access across the application
/// This manager handles the migration from old theme structure to new architecture
class ThemeManager {
  static ThemeManager? _instance;
  static ThemeManager get instance => _instance ??= ThemeManager._();

  ThemeManager._();

  /// Platform detection
  bool get isMobile => !kIsWeb;
  bool get isWeb => kIsWeb;
  bool get isDesktop => false; // For now, treat all non-web as mobile

  /// Get light theme based on current platform
  ThemeData getLightTheme() {
    if (isMobile) {
      return getMobileLightTheme();
    } else if (isWeb) {
      return getWebLightTheme();
    } else if (isDesktop) {
      return getDesktopLightTheme();
    }
    // Fallback to mobile theme
    return getMobileLightTheme();
  }

  /// Get dark theme based on current platform
  ThemeData getDarkTheme() {
    if (isMobile) {
      return getMobileDarkTheme();
    } else if (isWeb) {
      return getWebDarkTheme();
    } else if (isDesktop) {
      return getDesktopDarkTheme();
    }
    // Fallback to mobile theme
    return getMobileDarkTheme();
  }

  /// Get light theme with gradient extensions
  ThemeData getLightThemeWithExtensions() {
    final theme = getLightTheme();
    return theme.copyWith(
      extensions: [
        _createLightGradientExtension(),
      ],
    );
  }

  /// Get dark theme with gradient extensions
  ThemeData getDarkThemeWithExtensions() {
    final theme = getDarkTheme();
    return theme.copyWith(
      extensions: [
        _createDarkGradientExtension(),
      ],
    );
  }

  /// Create light gradient extension compatible with old GradientLight
  ThemeExtension<dynamic> _createLightGradientExtension() {
    return _GradientThemeExtension(
      primaryVertical: GradientExtensions.primaryLight,
      primaryHorizontal: LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: GradientExtensions.primaryLight.colors,
      ),
      purpleToPink: GradientExtensions.accentPink,
      subtleBackground: GradientExtensions.backgroundLight,
      buttonGradient: GradientExtensions.buttonPrimary,
      cardGradient: GradientExtensions.cardLight,
      purpleToBlue: GradientExtensions.accentPurple,
      tripleGradient: GradientExtensions.createGradient(
        colors: [
          const Color(0xFF4CAF50),
          const Color(0xFF8BC34A),
          const Color(0xFFCDDC39),
        ],
        stops: [0.0, 0.5, 1.0],
      ),
    );
  }

  /// Create dark gradient extension compatible with old GradientDark
  ThemeExtension<dynamic> _createDarkGradientExtension() {
    return _GradientThemeExtension(
      primaryVertical: GradientExtensions.primaryDark,
      primaryHorizontal: LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: GradientExtensions.primaryDark.colors,
      ),
      purpleToPink: GradientExtensions.accentPink,
      subtleBackground: GradientExtensions.backgroundDark,
      buttonGradient: GradientExtensions.buttonPrimary,
      cardGradient: GradientExtensions.cardDark,
      purpleToBlue: GradientExtensions.accentPurple,
      tripleGradient: GradientExtensions.createGradient(
        colors: [
          const Color(0xFFB15EFF),
          const Color(0xFFDA70D6),
          const Color(0xFFFF9DEA),
        ],
        stops: [0.0, 0.5, 1.0],
      ),
    );
  }

  /// Backward compatibility methods for old theme access
  /// These methods maintain the same API as the old theme system

  /// Get app light theme (backward compatibility)
  @Deprecated('Use getLightThemeWithExtensions() instead')
  ThemeData getAppLightTheme() {
    return getLightThemeWithExtensions();
  }

  /// Get app dark theme (backward compatibility)
  @Deprecated('Use getDarkThemeWithExtensions() instead')
  ThemeData getAppDarkTheme() {
    return getDarkThemeWithExtensions();
  }
}

/// Internal gradient theme extension that mimics the old GradientLight/GradientDark API
class _GradientThemeExtension extends ThemeExtension<_GradientThemeExtension> {
  final LinearGradient primaryVertical;
  final LinearGradient primaryHorizontal;
  final LinearGradient purpleToPink;
  final LinearGradient subtleBackground;
  final LinearGradient buttonGradient;
  final LinearGradient cardGradient;
  final LinearGradient purpleToBlue;
  final LinearGradient tripleGradient;

  const _GradientThemeExtension({
    required this.primaryVertical,
    required this.primaryHorizontal,
    required this.purpleToPink,
    required this.subtleBackground,
    required this.buttonGradient,
    required this.cardGradient,
    required this.purpleToBlue,
    required this.tripleGradient,
  });

  @override
  ThemeExtension<_GradientThemeExtension> copyWith({
    LinearGradient? primaryVertical,
    LinearGradient? primaryHorizontal,
    LinearGradient? purpleToPink,
    LinearGradient? subtleBackground,
    LinearGradient? buttonGradient,
    LinearGradient? cardGradient,
    LinearGradient? purpleToBlue,
    LinearGradient? tripleGradient,
  }) {
    return _GradientThemeExtension(
      primaryVertical: primaryVertical ?? this.primaryVertical,
      primaryHorizontal: primaryHorizontal ?? this.primaryHorizontal,
      purpleToPink: purpleToPink ?? this.purpleToPink,
      subtleBackground: subtleBackground ?? this.subtleBackground,
      buttonGradient: buttonGradient ?? this.buttonGradient,
      cardGradient: cardGradient ?? this.cardGradient,
      purpleToBlue: purpleToBlue ?? this.purpleToBlue,
      tripleGradient: tripleGradient ?? this.tripleGradient,
    );
  }

  @override
  ThemeExtension<_GradientThemeExtension> lerp(
      ThemeExtension<_GradientThemeExtension>? other, double t) {
    if (other is! _GradientThemeExtension) {
      return this;
    }
    return _GradientThemeExtension(
      primaryVertical: LinearGradient.lerp(primaryVertical, other.primaryVertical, t)!,
      primaryHorizontal: LinearGradient.lerp(primaryHorizontal, other.primaryHorizontal, t)!,
      purpleToPink: LinearGradient.lerp(purpleToPink, other.purpleToPink, t)!,
      subtleBackground: LinearGradient.lerp(subtleBackground, other.subtleBackground, t)!,
      buttonGradient: LinearGradient.lerp(buttonGradient, other.buttonGradient, t)!,
      cardGradient: LinearGradient.lerp(cardGradient, other.cardGradient, t)!,
      purpleToBlue: LinearGradient.lerp(purpleToBlue, other.purpleToBlue, t)!,
      tripleGradient: LinearGradient.lerp(tripleGradient, other.tripleGradient, t)!,
    );
  }

  /// Decoration methods for backward compatibility
  BoxDecoration decoration({
    LinearGradient? gradient,
    double borderRadius = 12.0,
    BoxBorder? border,
  }) {
    return BoxDecoration(
      gradient: gradient ?? primaryVertical,
      borderRadius: BorderRadius.circular(borderRadius),
      border: border,
      boxShadow: [
        BoxShadow(
          color: primaryVertical.colors.first.withAlpha(51),
          blurRadius: 10,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  BoxDecoration cardDecoration({
    LinearGradient? gradient,
    double borderRadius = 12.0,
  }) {
    return BoxDecoration(
      gradient: gradient ?? cardGradient,
      borderRadius: BorderRadius.circular(borderRadius),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withAlpha(26),
          blurRadius: 8,
          offset: const Offset(0, 3),
        ),
      ],
    );
  }

  BoxDecoration buttonDecoration({
    LinearGradient? gradient,
    double borderRadius = 12.0,
  }) {
    return BoxDecoration(
      gradient: gradient ?? buttonGradient,
      borderRadius: BorderRadius.circular(borderRadius),
      boxShadow: [
        BoxShadow(
          color: buttonGradient.colors.first.withAlpha(51),
          blurRadius: 10,
          spreadRadius: 1,
          offset: const Offset(0, 2),
        ),
      ],
    );
  }
}
