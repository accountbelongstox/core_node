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
import '../base/theme_colors.dart';

class GradientExtensions {
  // Light theme gradients
  static const LinearGradient primaryLight = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.blue,
      ThemeColors.blue80,
    ],
  );

  static const LinearGradient secondaryLight = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.green,
      ThemeColors.green80,
    ],
  );

  static const LinearGradient backgroundLight = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      ThemeColors.white,
      ThemeColors.white90,
    ],
  );

  static const LinearGradient surfaceLight = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.white100,
      ThemeColors.white80,
    ],
  );

  static const LinearGradient cardLight = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.white,
      ThemeColors.white90,
    ],
  );

  // Dark theme gradients
  static const LinearGradient primaryDark = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.blue60,
      ThemeColors.blue40,
    ],
  );

  static const LinearGradient secondaryDark = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.green60,
      ThemeColors.green40,
    ],
  );

  static const LinearGradient backgroundDark = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      ThemeColors.black,
      ThemeColors.black90,
    ],
  );

  static const LinearGradient surfaceDark = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.black80,
      ThemeColors.black70,
    ],
  );

  static const LinearGradient cardDark = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.black90,
      ThemeColors.black80,
    ],
  );

  // Accent gradients
  static const LinearGradient accentOrange = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.orange,
      ThemeColors.orange80,
    ],
  );

  static const LinearGradient accentPurple = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.purple,
      ThemeColors.purple80,
    ],
  );

  static const LinearGradient accentPink = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.pink,
      ThemeColors.pink80,
    ],
  );

  static const LinearGradient accentTeal = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.teal,
      ThemeColors.teal80,
    ],
  );

  // Special effect gradients
  static const LinearGradient shimmer = LinearGradient(
    begin: Alignment(-1.0, -0.3),
    end: Alignment(1.0, 0.3),
    colors: [
      Color(0xFFE0E0E0),
      Color(0xFFF5F5F5),
      Color(0xFFE0E0E0),
    ],
    stops: [0.0, 0.5, 1.0],
  );

  static const LinearGradient shimmerDark = LinearGradient(
    begin: Alignment(-1.0, -0.3),
    end: Alignment(1.0, 0.3),
    colors: [
      Color(0xFF2A2A2A),
      Color(0xFF3A3A3A),
      Color(0xFF2A2A2A),
    ],
    stops: [0.0, 0.5, 1.0],
  );

  static const RadialGradient spotlight = RadialGradient(
    center: Alignment.center,
    radius: 0.8,
    colors: [
      Color(0x33FFFFFF),
      Color(0x00FFFFFF),
    ],
  );

  static const RadialGradient spotlightDark = RadialGradient(
    center: Alignment.center,
    radius: 0.8,
    colors: [
      Color(0x33000000),
      Color(0x00000000),
    ],
  );

  // Button gradients
  static const LinearGradient buttonPrimary = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      ThemeColors.blue,
      ThemeColors.blue90,
    ],
  );

  static const LinearGradient buttonSecondary = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      ThemeColors.green,
      ThemeColors.green90,
    ],
  );

  static const LinearGradient buttonDanger = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      ThemeColors.red,
      ThemeColors.red90,
    ],
  );

  static const LinearGradient buttonWarning = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      ThemeColors.orange,
      ThemeColors.orange90,
    ],
  );

  // Utility methods
  static LinearGradient createGradient({
    required List<Color> colors,
    Alignment begin = Alignment.topLeft,
    Alignment end = Alignment.bottomRight,
    List<double>? stops,
  }) {
    return LinearGradient(
      begin: begin,
      end: end,
      colors: colors,
      stops: stops,
    );
  }

  static RadialGradient createRadialGradient({
    required List<Color> colors,
    Alignment center = Alignment.center,
    double radius = 0.5,
    List<double>? stops,
  }) {
    return RadialGradient(
      center: center,
      radius: radius,
      colors: colors,
      stops: stops,
    );
  }

  static SweepGradient createSweepGradient({
    required List<Color> colors,
    Alignment center = Alignment.center,
    double startAngle = 0.0,
    double endAngle = 6.28318530718, // 2 * pi
    List<double>? stops,
  }) {
    return SweepGradient(
      center: center,
      startAngle: startAngle,
      endAngle: endAngle,
      colors: colors,
      stops: stops,
    );
  }

  // Gradient with opacity
  static LinearGradient withOpacity(LinearGradient gradient, double opacity) {
    return LinearGradient(
      begin: gradient.begin,
      end: gradient.end,
      colors: gradient.colors.map((color) => color.withOpacity(opacity)).toList(),
      stops: gradient.stops,
    );
  }

  // Reverse gradient
  static LinearGradient reverse(LinearGradient gradient) {
    return LinearGradient(
      begin: gradient.end,
      end: gradient.begin,
      colors: gradient.colors.reversed.toList(),
      stops: gradient.stops?.reversed.toList(),
    );
  }

  // Blend two gradients
  static LinearGradient blend(LinearGradient gradient1, LinearGradient gradient2, double ratio) {
    final colors1 = gradient1.colors;
    final colors2 = gradient2.colors;
    final maxLength = colors1.length > colors2.length ? colors1.length : colors2.length;
    
    final blendedColors = <Color>[];
    for (int i = 0; i < maxLength; i++) {
      final color1 = i < colors1.length ? colors1[i] : colors1.last;
      final color2 = i < colors2.length ? colors2[i] : colors2.last;
      blendedColors.add(Color.lerp(color1, color2, ratio) ?? color1);
    }
    
    return LinearGradient(
      begin: gradient1.begin,
      end: gradient1.end,
      colors: blendedColors,
    );
  }

  // Get gradient by theme mode
  static LinearGradient getPrimaryGradient(bool isDark) {
    return isDark ? primaryDark : primaryLight;
  }

  static LinearGradient getSecondaryGradient(bool isDark) {
    return isDark ? secondaryDark : secondaryLight;
  }

  static LinearGradient getBackgroundGradient(bool isDark) {
    return isDark ? backgroundDark : backgroundLight;
  }

  static LinearGradient getSurfaceGradient(bool isDark) {
    return isDark ? surfaceDark : surfaceLight;
  }

  static LinearGradient getCardGradient(bool isDark) {
    return isDark ? cardDark : cardLight;
  }

  static LinearGradient getShimmerGradient(bool isDark) {
    return isDark ? shimmerDark : shimmer;
  }

  // Animated gradient colors for loading states
  static List<Color> getAnimatedColors(bool isDark) {
    return isDark
        ? [ThemeColors.black80, ThemeColors.black70, ThemeColors.black80]
        : [ThemeColors.white80, ThemeColors.white90, ThemeColors.white80];
  }
}
