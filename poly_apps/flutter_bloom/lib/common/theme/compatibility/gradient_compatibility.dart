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
import '../extensions/gradient_extensions.dart';

/// Compatibility layer for old GradientLight and GradientDark classes
/// This provides the same API as the old gradient system while using the new architecture

/// Light theme gradient extension for backward compatibility
class GradientLight extends ThemeExtension<GradientLight> {
  final LinearGradient primaryVertical;
  final LinearGradient primaryHorizontal;
  final LinearGradient purpleToPink;
  final LinearGradient subtleBackground;
  final LinearGradient buttonGradient;
  final LinearGradient cardGradient;
  final LinearGradient purpleToBlue;
  final LinearGradient tripleGradient;

  const GradientLight({
    this.primaryVertical = const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color(0xFF4CAF50), // Primary green
        Color(0xFF8BC34A), // Lighter green
      ],
    ),
    this.primaryHorizontal = const LinearGradient(
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
      colors: [
        Color(0xFF4CAF50), // Primary green
        Color(0xFF8BC34A), // Lighter green
      ],
    ),
    this.purpleToPink = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xFF8A2BE2), // Primary purple
        Color(0xFFDA70D6), // Pink
      ],
    ),
    this.subtleBackground = const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color(0xFFF1F8E9),
        Color(0xFFF9FBE7),
      ],
    ),
    this.buttonGradient = const LinearGradient(
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
      colors: [
        Color(0xFF4CAF50), // Primary green
        Color(0xFF66BB6A), // Medium green
      ],
    ),
    this.cardGradient = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xFFFFFFFF),
        Color(0xFFF1F8E9),
      ],
    ),
    this.purpleToBlue = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xFF8A2BE2), // Primary purple
        Color(0xFF4158D0), // Blue
      ],
    ),
    this.tripleGradient = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      stops: [0.0, 0.5, 1.0],
      colors: [
        Color(0xFF4CAF50), // Primary green
        Color(0xFF8BC34A), // Light green
        Color(0xFFCDDC39), // Lime
      ],
    ),
  });

  @override
  ThemeExtension<GradientLight> copyWith({
    LinearGradient? primaryVertical,
    LinearGradient? primaryHorizontal,
    LinearGradient? purpleToPink,
    LinearGradient? subtleBackground,
    LinearGradient? buttonGradient,
    LinearGradient? cardGradient,
    LinearGradient? purpleToBlue,
    LinearGradient? tripleGradient,
  }) {
    return GradientLight(
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
  ThemeExtension<GradientLight> lerp(
      ThemeExtension<GradientLight>? other, double t) {
    if (other is! GradientLight) {
      return this;
    }
    return GradientLight(
      primaryVertical:
          LinearGradient.lerp(primaryVertical, other.primaryVertical, t)!,
      primaryHorizontal:
          LinearGradient.lerp(primaryHorizontal, other.primaryHorizontal, t)!,
      purpleToPink: LinearGradient.lerp(purpleToPink, other.purpleToPink, t)!,
      subtleBackground:
          LinearGradient.lerp(subtleBackground, other.subtleBackground, t)!,
      buttonGradient:
          LinearGradient.lerp(buttonGradient, other.buttonGradient, t)!,
      cardGradient: LinearGradient.lerp(cardGradient, other.cardGradient, t)!,
      purpleToBlue: LinearGradient.lerp(purpleToBlue, other.purpleToBlue, t)!,
      tripleGradient:
          LinearGradient.lerp(tripleGradient, other.tripleGradient, t)!,
    );
  }

  /// Decoration for gradient containers with rounded corners
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
          color: const Color(0xFF4CAF50).withAlpha(51), // 20% opacity
          blurRadius: 10,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  /// Card decoration with gradient
  BoxDecoration cardDecoration({
    LinearGradient? gradient,
    double borderRadius = 12.0,
  }) {
    return BoxDecoration(
      gradient: gradient ?? cardGradient,
      borderRadius: BorderRadius.circular(borderRadius),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withAlpha(26), // 10% opacity
          blurRadius: 8,
          offset: const Offset(0, 3),
        ),
      ],
    );
  }

  /// Button decoration with gradient
  BoxDecoration buttonDecoration({
    LinearGradient? gradient,
    double borderRadius = 12.0,
  }) {
    return BoxDecoration(
      gradient: gradient ?? buttonGradient,
      borderRadius: BorderRadius.circular(borderRadius),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFF4CAF50).withAlpha(51), // 20% opacity
          blurRadius: 10,
          spreadRadius: 1,
          offset: const Offset(0, 2),
        ),
      ],
    );
  }
}

/// Dark theme gradient extension for backward compatibility
class GradientDark extends ThemeExtension<GradientDark> {
  final LinearGradient primaryVertical;
  final LinearGradient primaryHorizontal;
  final LinearGradient purpleToPink;
  final LinearGradient subtleBackground;
  final LinearGradient buttonGradient;
  final LinearGradient cardGradient;
  final LinearGradient purpleToBlue;
  final LinearGradient tripleGradient;

  const GradientDark({
    this.primaryVertical = const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color(0xFFB15EFF), // Primary purple
        Color(0xFF9A49FF), // Darker purple
      ],
    ),
    this.primaryHorizontal = const LinearGradient(
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
      colors: [
        Color(0xFFB15EFF), // Primary purple
        Color(0xFF9A49FF), // Darker purple
      ],
    ),
    this.purpleToPink = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xFFB15EFF), // Primary purple
        Color(0xFFDA70D6), // Pink
      ],
    ),
    this.subtleBackground = const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color(0xFF1F1A2E),
        Color(0xFF261F35),
      ],
    ),
    this.buttonGradient = const LinearGradient(
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
      colors: [
        Color(0xFFB15EFF), // Primary purple
        Color(0xFF8A4FD1), // Medium purple
      ],
    ),
    this.cardGradient = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xFF2A2040),
        Color(0xFF382D5E),
      ],
    ),
    this.purpleToBlue = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xFFB15EFF), // Primary purple
        Color(0xFF4158D0), // Blue
      ],
    ),
    this.tripleGradient = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      stops: [0.0, 0.5, 1.0],
      colors: [
        Color(0xFFB15EFF), // Primary purple
        Color(0xFFDA70D6), // Pink
        Color(0xFFFF9DEA), // Light pink
      ],
    ),
  });

  @override
  ThemeExtension<GradientDark> copyWith({
    LinearGradient? primaryVertical,
    LinearGradient? primaryHorizontal,
    LinearGradient? purpleToPink,
    LinearGradient? subtleBackground,
    LinearGradient? buttonGradient,
    LinearGradient? cardGradient,
    LinearGradient? purpleToBlue,
    LinearGradient? tripleGradient,
  }) {
    return GradientDark(
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
  ThemeExtension<GradientDark> lerp(
      ThemeExtension<GradientDark>? other, double t) {
    if (other is! GradientDark) {
      return this;
    }
    return GradientDark(
      primaryVertical:
          LinearGradient.lerp(primaryVertical, other.primaryVertical, t)!,
      primaryHorizontal:
          LinearGradient.lerp(primaryHorizontal, other.primaryHorizontal, t)!,
      purpleToPink: LinearGradient.lerp(purpleToPink, other.purpleToPink, t)!,
      subtleBackground:
          LinearGradient.lerp(subtleBackground, other.subtleBackground, t)!,
      buttonGradient:
          LinearGradient.lerp(buttonGradient, other.buttonGradient, t)!,
      cardGradient: LinearGradient.lerp(cardGradient, other.cardGradient, t)!,
      purpleToBlue: LinearGradient.lerp(purpleToBlue, other.purpleToBlue, t)!,
      tripleGradient:
          LinearGradient.lerp(tripleGradient, other.tripleGradient, t)!,
    );
  }

  /// Decoration for gradient containers with rounded corners
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
          color: const Color(0xFFB15EFF).withAlpha(51), // 20% opacity
          blurRadius: 10,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  /// Card decoration with gradient
  BoxDecoration cardDecoration({
    LinearGradient? gradient,
    double borderRadius = 12.0,
  }) {
    return BoxDecoration(
      gradient: gradient ?? cardGradient,
      borderRadius: BorderRadius.circular(borderRadius),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withAlpha(51), // 20% opacity
          blurRadius: 8,
          offset: const Offset(0, 3),
        ),
      ],
    );
  }

  /// Button decoration with gradient
  BoxDecoration buttonDecoration({
    LinearGradient? gradient,
    double borderRadius = 12.0,
  }) {
    return BoxDecoration(
      gradient: gradient ?? buttonGradient,
      borderRadius: BorderRadius.circular(borderRadius),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFFB15EFF).withAlpha(51), // 20% opacity
          blurRadius: 10,
          spreadRadius: 1,
          offset: const Offset(0, 2),
        ),
      ],
    );
  }
}
