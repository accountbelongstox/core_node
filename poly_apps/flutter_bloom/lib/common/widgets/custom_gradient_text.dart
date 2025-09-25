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
import 'package:qyflutter/common/theme/compatibility/gradient_compatibility.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

/// Gradient style constants
class GradientStyle {
  static const int primary = 0; // Vertical gradient
  static const int horizontal = 1; // Horizontal gradient
  static const int diagonal = 2; // Diagonal gradient
  static const int button = 3; // Button gradient
  static const int glowing = 4; // Glowing effect
  static const int neon = 5; // Neon effect
}

class CustomGradientText extends StatelessWidget {
  final String text;
  final double fontSize;
  final int gradientStyleIndex;
  final TextStyle? style;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;

  const CustomGradientText({
    super.key,
    required this.text,
    this.fontSize = 16.0,
    this.gradientStyleIndex = 0,
    this.style,
    this.textAlign,
    this.maxLines,
    this.overflow,
  });

  LinearGradient _getGradient(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (isDark) {
      final darkTheme = Theme.of(context).extension<GradientDark>();
      if (darkTheme == null) {
        throw FlutterError(
          'GradientDark theme extension not found. Make sure it is added to ThemeData.extensions in your app theme.',
        );
      }

      switch (gradientStyleIndex) {
        case 0:
          return darkTheme.primaryVertical;
        case 1:
          return darkTheme.primaryHorizontal;
        case 2:
          return darkTheme.purpleToPink;
        case 3:
          return darkTheme.buttonGradient;
        case 4:
          return darkTheme.tripleGradient;
        case 5:
          return darkTheme.purpleToBlue;
        default:
          return darkTheme.primaryVertical;
      }
    } else {
      final lightTheme = Theme.of(context).extension<GradientLight>();
      if (lightTheme == null) {
        throw FlutterError(
          'GradientLight theme extension not found. Make sure it is added to ThemeData.extensions in your app theme.',
        );
      }

      switch (gradientStyleIndex) {
        case 0:
          return lightTheme.primaryVertical;
        case 1:
          return lightTheme.primaryHorizontal;
        case 2:
          return lightTheme.purpleToPink;
        case 3:
          return lightTheme.buttonGradient;
        case 4:
          return lightTheme.tripleGradient;
        case 5:
          return lightTheme.purpleToBlue;
        default:
          return lightTheme.primaryVertical;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: (bounds) => _getGradient(context).createShader(bounds),
      child: Text(
        text,
        style: (style ?? ThemeTextStyles.textRegular).copyWith(
          fontSize: fontSize,
        ),
        textAlign: textAlign,
        maxLines: maxLines,
        overflow: overflow,
      ),
    );
  }
}

// Example usage:
// CustomGradientText(
//   text: 'Welcome',
//   fontSize: 24.0,
//   gradientStyleIndex: 4, // 0: primary vertical
//                         // 1: primary horizontal
//                         // 2: purple to pink
//                         // 3: button gradient
//                         // 4: glowing/triple gradient
//                         // 5: neon/purple to blue
//   style: textSemiBold,
//   textAlign: TextAlign.center,
// )
