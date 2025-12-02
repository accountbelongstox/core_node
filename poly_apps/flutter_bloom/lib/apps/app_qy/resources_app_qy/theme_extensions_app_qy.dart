import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class ThemeExtensionsAppQy {

  static BoxDecoration get qyGlassmorphismCard => BoxDecoration(
    color: ColorsAppQy.qyFrostWhite,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
    border: Border.all(
      color: ColorsAppQy.qyBorderLight.withOpacity(0.5),
      width: 1,
    ),
    boxShadow: [
      BoxShadow(
        color: ColorsAppQy.qyShadowLight,
        blurRadius: 20,
        offset: const Offset(0, 8),
        spreadRadius: 0,
      ),
    ],
  );

  static BoxDecoration get qyFrostedGlassCard => BoxDecoration(
    color: ColorsAppQy.qyGlassWhite,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
    border: Border.all(
      color: ColorsAppQy.qyFrostMedium,
      width: 1.5,
    ),
    boxShadow: [
      BoxShadow(
        color: ColorsAppQy.qyShadowMedium,
        blurRadius: 24,
        offset: const Offset(0, 12),
        spreadRadius: -4,
      ),
    ],
  );

  static BoxDecoration get qyHolographicCard => BoxDecoration(
    gradient: ColorsAppQy.qyHolographicGradient,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
    border: Border.all(
      color: ColorsAppQy.qyBorderLight,
      width: 1,
    ),
    boxShadow: [
      BoxShadow(
        color: ColorsAppQy.qyShadowMedium,
        blurRadius: 16,
        offset: const Offset(0, 6),
      ),
    ],
  );

  static BoxDecoration qyBlurBackgroundDecoration({
    double sigmaX = 10,
    double sigmaY = 10,
    Color? backgroundColor,
  }) {
    return BoxDecoration(
      color: backgroundColor ?? ColorsAppQy.qyGlassWhite,
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      border: Border.all(
        color: ColorsAppQy.qyFrostLight,
        width: 1,
      ),
    );
  }

  static BoxDecoration get qyPrimaryCard => BoxDecoration(
    gradient: ColorsAppQy.qyPrimaryGradient,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
    boxShadow: [
      BoxShadow(
        color: ColorsAppQy.qyPrimary.withOpacity(0.3),
        blurRadius: 20,
        offset: const Offset(0, 8),
      ),
    ],
  );

  static BoxDecoration get qySecondaryCard => BoxDecoration(
    gradient: ColorsAppQy.qySecondaryGradient,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
    boxShadow: [
      BoxShadow(
        color: ColorsAppQy.qySecondary.withOpacity(0.3),
        blurRadius: 20,
        offset: const Offset(0, 8),
      ),
    ],
  );

  static BoxDecoration get qyAccentCard => BoxDecoration(
    gradient: ColorsAppQy.qyAccentGradient,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
    boxShadow: [
      BoxShadow(
        color: ColorsAppQy.qyAccent.withOpacity(0.3),
        blurRadius: 20,
        offset: const Offset(0, 8),
      ),
    ],
  );

  static BoxDecoration qyCardWithGradient(Gradient gradient) {
    return BoxDecoration(
      gradient: gradient,
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      border: Border.all(
        color: ColorsAppQy.qyFrostLight,
        width: 1,
      ),
    );
  }

  static BoxDecoration qyFrostedCardWithColor(Color color) {
    return BoxDecoration(
      color: color.withOpacity(0.1),
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
      border: Border.all(
        color: color.withOpacity(0.5),
        width: 1.5,
      ),
    );
  }

  static BoxDecoration get qyBentoBox => BoxDecoration(
    color: ColorsAppQy.qyGlassWhite,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
    border: Border.all(
      color: ColorsAppQy.qyBorderLight.withOpacity(0.3),
      width: 1,
    ),
  );

  static BoxDecoration get qyInputDecoration => BoxDecoration(
    color: ColorsAppQy.qyFrostLight,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
    border: Border.all(
      color: ColorsAppQy.qyBorderLight.withOpacity(0.3),
      width: 1,
    ),
  );

  static InputDecoration qyTextFieldDecoration({
    String? hintText,
    String? labelText,
    Widget? prefixIcon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      labelText: labelText,
      prefixIcon: prefixIcon,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: ColorsAppQy.qyFrostLight,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        borderSide: BorderSide(
          color: ColorsAppQy.qyBorderLight.withOpacity(0.3),
          width: 1,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        borderSide: BorderSide(
          color: ColorsAppQy.qyBorderLight.withOpacity(0.3),
          width: 1,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        borderSide: const BorderSide(
          color: ColorsAppQy.qyPrimary,
          width: 2,
        ),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        borderSide: BorderSide(
          color: ColorsAppQy.qyError.withOpacity(0.5),
          width: 1,
        ),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        borderSide: const BorderSide(
          color: ColorsAppQy.qyError,
          width: 2,
        ),
      ),
    );
  }

  static ButtonStyle get qyPrimaryButtonStyle => ElevatedButton.styleFrom(
    backgroundColor: ColorsAppQy.qyPrimary,
    foregroundColor: ColorsAppQy.qyTextOnPrimary,
    elevation: 0,
    padding: const EdgeInsets.symmetric(
      horizontal: ThemeDimensions.spacing24,
      vertical: ThemeDimensions.spacing16,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
    ),
    shadowColor: ColorsAppQy.qyPrimary.withOpacity(0.3),
  );

  static ButtonStyle get qySecondaryButtonStyle => OutlinedButton.styleFrom(
    foregroundColor: ColorsAppQy.qyPrimary,
    side: const BorderSide(color: ColorsAppQy.qyPrimary, width: 1.5),
    padding: const EdgeInsets.symmetric(
      horizontal: ThemeDimensions.spacing24,
      vertical: ThemeDimensions.spacing16,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
    ),
  );

  static ButtonStyle get qyGlassButtonStyle => ElevatedButton.styleFrom(
    backgroundColor: ColorsAppQy.qyGlassWhite,
    foregroundColor: ColorsAppQy.qyTextPrimary,
    elevation: 0,
    padding: const EdgeInsets.symmetric(
      horizontal: ThemeDimensions.spacing24,
      vertical: ThemeDimensions.spacing16,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
      side: BorderSide(
        color: ColorsAppQy.qyBorderLight.withOpacity(0.3),
        width: 1,
      ),
    ),
  );

  static Widget applyBlur({
    required Widget child,
    double sigmaX = 15,
    double sigmaY = 15,
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: sigmaX, sigmaY: sigmaY),
        child: child,
      ),
    );
  }

  static Widget buildFrostedContainer({
    required Widget child,
    EdgeInsets? padding,
    EdgeInsets? margin,
    Color? backgroundColor,
    BorderRadius? borderRadius,
  }) {
    return Container(
      padding: padding,
      margin: margin,
      decoration: BoxDecoration(
        color: backgroundColor ?? ColorsAppQy.qyGlassWhite,
        borderRadius: borderRadius ?? BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(
          color: ColorsAppQy.qyFrostLight,
          width: 1,
        ),
      ),
      child: child,
    );
  }

  static Widget qyFrostedContainer({
    required Widget child,
    EdgeInsets? padding,
    EdgeInsets? margin,
    Color? backgroundColor,
    BorderRadius? borderRadius,
  }) {
    return buildFrostedContainer(
      child: child,
      padding: padding,
      margin: margin,
      backgroundColor: backgroundColor,
      borderRadius: borderRadius,
    );
  }

  static BoxDecoration qyDynamicGradientDecoration(double animationValue) {
    return BoxDecoration(
      gradient: ColorsAppQy.qyDynamicShimmerGradient(animationValue),
    );
  }

  static BoxDecoration get qyChipDecoration => BoxDecoration(
    color: ColorsAppQy.qyPrimary.withOpacity(0.1),
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
    border: Border.all(
      color: ColorsAppQy.qyPrimary.withOpacity(0.3),
      width: 1,
    ),
  );

  static BoxDecoration get qySelectedChipDecoration => BoxDecoration(
    gradient: ColorsAppQy.qyPrimaryGradient,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
    boxShadow: [
      BoxShadow(
        color: ColorsAppQy.qyPrimary.withOpacity(0.3),
        blurRadius: 8,
        offset: const Offset(0, 4),
      ),
    ],
  );

  static BoxDecoration get qyBadgeDecoration => BoxDecoration(
    gradient: ColorsAppQy.qyAccentGradient,
    borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
  );

  static BoxDecoration qyProgressBarDecoration(double progress) {
    return BoxDecoration(
      gradient: LinearGradient(
        colors: [
          ColorsAppQy.qyPrimary,
          ColorsAppQy.qySecondary,
        ],
        stops: [progress.clamp(0.0, 1.0), progress.clamp(0.0, 1.0)],
      ),
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
    );
  }

  static BoxDecoration get qyDividerDecoration => BoxDecoration(
    gradient: LinearGradient(
      colors: [
        ColorsAppQy.qyBorderLight.withOpacity(0),
        ColorsAppQy.qyBorderLight,
        ColorsAppQy.qyBorderLight.withOpacity(0),
      ],
    ),
  );

  static BoxDecoration get qyNavBarDecoration => BoxDecoration(
    color: ColorsAppQy.qyGlassWhite,
    border: Border(
      top: BorderSide(
        color: ColorsAppQy.qyBorderLight.withOpacity(0.2),
        width: 1,
      ),
    ),
    boxShadow: [
      BoxShadow(
        color: ColorsAppQy.qyShadowLight,
        blurRadius: 8,
        offset: const Offset(0, -2),
      ),
    ],
  );
}
