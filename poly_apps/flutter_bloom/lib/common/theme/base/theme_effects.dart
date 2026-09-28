import 'dart:ui';
import 'package:flutter/material.dart';
import 'theme_colors.dart';
import 'theme_shadow.dart';
import 'theme_gradients.dart';
import 'theme_dimensions.dart';

class ThemeEffects {
  static BoxDecoration glassmorphism({
    Color color = Colors.white,
    double opacity = 0.2,
    double borderOpacity = 0.3,
    double blurAmount = 10.0,
    BorderRadius? borderRadius,
    List<BoxShadow>? boxShadow,
  }) {
    return BoxDecoration(
      color: color.withOpacity(opacity),
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      border: Border.all(
        color: Colors.white.withOpacity(borderOpacity),
        width: 1.5,
      ),
      boxShadow: boxShadow ?? ThemeShadow.medium,
    );
  }

  static BoxDecoration frostedGlass({
    Color color = Colors.white,
    double opacity = 0.15,
    BorderRadius? borderRadius,
  }) {
    return BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          color.withOpacity(opacity * 1.5),
          color.withOpacity(opacity),
        ],
      ),
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      border: Border.all(
        color: Colors.white.withOpacity(0.2),
        width: 1,
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.1),
          blurRadius: 20,
          spreadRadius: -5,
          offset: const Offset(0, 10),
        ),
      ],
    );
  }

  static BoxDecoration neonGlow({
    required Color color,
    double glowIntensity = 0.5,
    BorderRadius? borderRadius,
    double borderWidth = 2.0,
  }) {
    return BoxDecoration(
      color: color.withOpacity(0.1),
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      border: Border.all(
        color: color,
        width: borderWidth,
      ),
      boxShadow: [
        BoxShadow(
          color: color.withOpacity(glowIntensity),
          blurRadius: 20,
          spreadRadius: 2,
        ),
        BoxShadow(
          color: color.withOpacity(glowIntensity * 0.5),
          blurRadius: 40,
          spreadRadius: 5,
        ),
      ],
    );
  }

  static BoxDecoration metallicSheen({
    required Color baseColor,
    BorderRadius? borderRadius,
  }) {
    return BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          baseColor.withOpacity(0.9),
          baseColor,
          baseColor.withOpacity(0.7),
          baseColor,
          baseColor.withOpacity(0.9),
        ],
        stops: const [0.0, 0.25, 0.5, 0.75, 1.0],
      ),
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      boxShadow: ThemeShadow.premium,
    );
  }

  static BoxDecoration premiumCard({
    LinearGradient? gradient,
    BorderRadius? borderRadius,
    bool elevated = true,
  }) {
    return BoxDecoration(
      gradient: gradient ?? ThemeGradients.primaryBlue,
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      boxShadow: elevated ? ThemeShadow.premium : ThemeShadow.card,
      border: Border.all(
        color: Colors.white.withOpacity(0.1),
        width: 1,
      ),
    );
  }

  static BoxDecoration elevatedCard({
    Color? backgroundColor,
    BorderRadius? borderRadius,
    int elevation = 2,
  }) {
    List<BoxShadow> shadow;
    switch (elevation) {
      case 1:
        shadow = ThemeShadow.small;
        break;
      case 2:
        shadow = ThemeShadow.medium;
        break;
      case 3:
        shadow = ThemeShadow.large;
        break;
      case 4:
        shadow = ThemeShadow.extraLarge;
        break;
      default:
        shadow = ThemeShadow.premium;
    }

    return BoxDecoration(
      color: backgroundColor ?? ThemeColors.neutralWhite,
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      boxShadow: shadow,
    );
  }

  static BoxDecoration gradientBorder({
    required LinearGradient gradient,
    double borderWidth = 2.0,
    BorderRadius? borderRadius,
    Color? backgroundColor,
  }) {
    return BoxDecoration(
      color: backgroundColor ?? ThemeColors.neutralWhite,
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      border: Border.all(
        color: Colors.transparent,
        width: borderWidth,
      ),
    );
  }

  static BoxDecoration shimmerEffect({
    Color baseColor = const Color(0xFFE0E0E0),
    Color highlightColor = const Color(0xFFF5F5F5),
    BorderRadius? borderRadius,
  }) {
    return BoxDecoration(
      gradient: ThemeGradients.shimmer(
        baseColor: baseColor,
        highlightColor: highlightColor,
      ),
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusM,
    );
  }

  static BoxDecoration innerShadow({
    Color shadowColor = Colors.black,
    double opacity = 0.1,
    BorderRadius? borderRadius,
    Color? backgroundColor,
  }) {
    return BoxDecoration(
      color: backgroundColor ?? ThemeColors.neutralWhite,
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      boxShadow: [
        BoxShadow(
          color: shadowColor.withOpacity(opacity),
          offset: const Offset(0, 2),
          blurRadius: 4,
          spreadRadius: -2,
        ),
      ],
    );
  }

  static BoxDecoration neumorphism({
    Color backgroundColor = const Color(0xFFE0E0E0),
    BorderRadius? borderRadius,
    bool isPressed = false,
  }) {
    return BoxDecoration(
      color: backgroundColor,
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
      boxShadow: isPressed
          ? [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                offset: const Offset(2, 2),
                blurRadius: 4,
                spreadRadius: -2,
              ),
              BoxShadow(
                color: Colors.white.withOpacity(0.7),
                offset: const Offset(-2, -2),
                blurRadius: 4,
                spreadRadius: -2,
              ),
            ]
          : [
              BoxShadow(
                color: Colors.black.withOpacity(0.15),
                offset: const Offset(8, 8),
                blurRadius: 16,
              ),
              BoxShadow(
                color: Colors.white.withOpacity(0.9),
                offset: const Offset(-8, -8),
                blurRadius: 16,
              ),
            ],
    );
  }

  static Widget blurBackground({
    required Widget child,
    double blurAmount = 10.0,
    Color? backgroundColor,
  }) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: blurAmount,
          sigmaY: blurAmount,
        ),
        child: Container(
          color: backgroundColor ?? Colors.white.withOpacity(0.2),
          child: child,
        ),
      ),
    );
  }

  static Widget gradientMask({
    required Widget child,
    required Gradient gradient,
  }) {
    return ShaderMask(
      shaderCallback: (Rect bounds) {
        return gradient.createShader(bounds);
      },
      blendMode: BlendMode.srcIn,
      child: child,
    );
  }

  static Widget rippleEffect({
    required Widget child,
    Color? rippleColor,
    BorderRadius? borderRadius,
    VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
        splashColor: rippleColor ?? ThemeColors.primaryBlue.withOpacity(0.2),
        highlightColor:
            rippleColor?.withOpacity(0.1) ?? ThemeColors.primaryBlue.withOpacity(0.1),
        child: child,
      ),
    );
  }

  static Widget glowingBorder({
    required Widget child,
    required Color glowColor,
    double glowRadius = 20.0,
    double borderWidth = 2.0,
    BorderRadius? borderRadius,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
        boxShadow: [
          BoxShadow(
            color: glowColor.withOpacity(0.5),
            blurRadius: glowRadius,
            spreadRadius: 2,
          ),
        ],
        border: Border.all(
          color: glowColor,
          width: borderWidth,
        ),
      ),
      child: child,
    );
  }

  static Widget shimmerLoading({
    required Widget child,
    bool isLoading = true,
    Duration duration = const Duration(milliseconds: 1500),
  }) {
    if (!isLoading) return child;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: -2.0, end: 2.0),
      duration: duration,
      builder: (context, value, child) {
        return ShaderMask(
          shaderCallback: (Rect bounds) {
            return LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: const [
                Color(0xFFE0E0E0),
                Color(0xFFF5F5F5),
                Color(0xFFE0E0E0),
              ],
              stops: [
                (value - 1).clamp(0.0, 1.0),
                value.clamp(0.0, 1.0),
                (value + 1).clamp(0.0, 1.0),
              ],
            ).createShader(bounds);
          },
          blendMode: BlendMode.srcATop,
          child: child,
        );
      },
      onEnd: () {},
      child: child,
    );
  }
}
