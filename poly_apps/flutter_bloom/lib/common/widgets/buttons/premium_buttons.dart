import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_shadow.dart';
import 'package:qyflutter/common/theme/base/theme_gradients.dart';
import 'package:qyflutter/common/theme/base/theme_effects.dart';

class GlowButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final Color glowColor;
  final double glowIntensity;
  final double? height;
  final double? width;

  const GlowButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.glowColor = ThemeColors.primaryBlue,
    this.glowIntensity = 0.5,
    this.height,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    final buttonHeight = height ?? 56.0;
    final buttonWidth = isFullWidth ? double.infinity : width;

    return SizedBox(
      height: buttonHeight,
      width: buttonWidth,
      child: Container(
        decoration: ThemeEffects.neonGlow(
          color: onPressed == null ? ThemeColors.neutralGrey : glowColor,
          glowIntensity: onPressed == null ? 0 : glowIntensity,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: isLoading ? null : onPressed,
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
            child: Container(
              alignment: Alignment.center,
              child: isLoading
                  ? SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          ThemeColors.neutralWhite,
                        ),
                      ),
                    )
                  : icon != null
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              icon,
                              size: 20,
                              color: ThemeColors.neutralWhite,
                            ),
                            SizedBox(width: ThemeDimensions.smallPadding),
                            Text(
                              text,
                              style: ThemeTextStyles.bodyLarge.copyWith(
                                color: ThemeColors.neutralWhite,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        )
                      : Text(
                          text,
                          style: ThemeTextStyles.bodyLarge.copyWith(
                            color: ThemeColors.neutralWhite,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
            ),
          ),
        ),
      ),
    );
  }
}

class PremiumGradientButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final LinearGradient? gradient;
  final double? height;
  final double? width;

  const PremiumGradientButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.gradient,
    this.height,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    final buttonHeight = height ?? 56.0;
    final buttonWidth = isFullWidth ? double.infinity : width;
    final buttonGradient = gradient ?? ThemeGradients.primaryBlue;

    return SizedBox(
      height: buttonHeight,
      width: buttonWidth,
      child: Container(
        decoration: BoxDecoration(
          gradient: onPressed == null && !isLoading
              ? const LinearGradient(
                  colors: [
                    Color(0xFFE0E0E0),
                    Color(0xFFE0E0E0),
                  ],
                )
              : buttonGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          boxShadow: onPressed != null && !isLoading
              ? ThemeShadow.button
              : [],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: isLoading ? null : onPressed,
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
            child: Container(
              alignment: Alignment.center,
              child: isLoading
                  ? SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          ThemeColors.neutralWhite,
                        ),
                      ),
                    )
                  : icon != null
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              icon,
                              size: 20,
                              color: ThemeColors.neutralWhite,
                            ),
                            SizedBox(width: ThemeDimensions.smallPadding),
                            Text(
                              text,
                              style: ThemeTextStyles.bodyLarge.copyWith(
                                color: ThemeColors.neutralWhite,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        )
                      : Text(
                          text,
                          style: ThemeTextStyles.bodyLarge.copyWith(
                            color: ThemeColors.neutralWhite,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
            ),
          ),
        ),
      ),
    );
  }
}

class VipTierButton extends StatelessWidget {
  final String text;
  final String tier;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final double? height;

  const VipTierButton({
    super.key,
    required this.text,
    required this.tier,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    final gradient = ThemeGradients.getVipTierGradient(tier);

    return PremiumGradientButton(
      text: text,
      onPressed: onPressed,
      isLoading: isLoading,
      isFullWidth: isFullWidth,
      icon: icon,
      gradient: gradient,
      height: height,
    );
  }
}

class GlassButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final Color? backgroundColor;
  final Color? textColor;
  final double? height;
  final double? width;

  const GlassButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.backgroundColor,
    this.textColor,
    this.height,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    final buttonHeight = height ?? 56.0;
    final buttonWidth = isFullWidth ? double.infinity : width;

    return SizedBox(
      height: buttonHeight,
      width: buttonWidth,
      child: Container(
        decoration: ThemeEffects.frostedGlass(
          color: backgroundColor ?? Colors.white,
          opacity: 0.2,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: isLoading ? null : onPressed,
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
            child: Container(
              alignment: Alignment.center,
              child: isLoading
                  ? SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          textColor ?? ThemeColors.neutralWhite,
                        ),
                      ),
                    )
                  : icon != null
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              icon,
                              size: 20,
                              color: textColor ?? ThemeColors.neutralWhite,
                            ),
                            SizedBox(width: ThemeDimensions.smallPadding),
                            Text(
                              text,
                              style: ThemeTextStyles.bodyLarge.copyWith(
                                color: textColor ?? ThemeColors.neutralWhite,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        )
                      : Text(
                          text,
                          style: ThemeTextStyles.bodyLarge.copyWith(
                            color: textColor ?? ThemeColors.neutralWhite,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
            ),
          ),
        ),
      ),
    );
  }
}

class NeumorphicButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final Color? backgroundColor;
  final Color? textColor;
  final double? height;

  const NeumorphicButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.backgroundColor,
    this.textColor,
    this.height,
  });

  @override
  State<NeumorphicButton> createState() => _NeumorphicButtonState();
}

class _NeumorphicButtonState extends State<NeumorphicButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final buttonHeight = widget.height ?? 56.0;
    final buttonWidth = widget.isFullWidth ? double.infinity : null;

    return SizedBox(
      height: buttonHeight,
      width: buttonWidth,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) {
          setState(() => _isPressed = false);
          if (widget.onPressed != null && !widget.isLoading) {
            widget.onPressed!();
          }
        },
        onTapCancel: () => setState(() => _isPressed = false),
        child: Container(
          decoration: ThemeEffects.neumorphism(
            backgroundColor:
                widget.backgroundColor ?? const Color(0xFFE0E0E0),
            isPressed: _isPressed,
          ),
          alignment: Alignment.center,
          child: widget.isLoading
              ? SizedBox(
                  height: 24,
                  width: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      widget.textColor ?? ThemeColors.primaryBlue,
                    ),
                  ),
                )
              : widget.icon != null
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          widget.icon,
                          size: 20,
                          color: widget.textColor ?? ThemeColors.primaryBlue,
                        ),
                        SizedBox(width: ThemeDimensions.smallPadding),
                        Text(
                          widget.text,
                          style: ThemeTextStyles.bodyLarge.copyWith(
                            color: widget.textColor ?? ThemeColors.primaryBlue,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    )
                  : Text(
                      widget.text,
                      style: ThemeTextStyles.bodyLarge.copyWith(
                        color: widget.textColor ?? ThemeColors.primaryBlue,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
        ),
      ),
    );
  }
}

class IconGradientButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final LinearGradient? gradient;
  final double size;
  final Color? iconColor;

  const IconGradientButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.gradient,
    this.size = 48.0,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final buttonGradient = gradient ?? ThemeGradients.primaryBlue;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: buttonGradient,
        shape: BoxShape.circle,
        boxShadow: ThemeShadow.button,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: Icon(
            icon,
            color: iconColor ?? ThemeColors.neutralWhite,
            size: size * 0.5,
          ),
        ),
      ),
    );
  }
}

class FloatingGradientButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final IconData icon;
  final LinearGradient? gradient;
  final bool isExtended;

  const FloatingGradientButton({
    super.key,
    required this.text,
    required this.icon,
    this.onPressed,
    this.gradient,
    this.isExtended = true,
  });

  @override
  Widget build(BuildContext context) {
    final buttonGradient = gradient ?? ThemeGradients.primaryBlue;

    return Container(
      decoration: BoxDecoration(
        gradient: buttonGradient,
        borderRadius: BorderRadius.circular(
          isExtended ? ThemeDimensions.largeRadius : 28,
        ),
        boxShadow: ThemeShadow.floating,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(
            isExtended ? ThemeDimensions.largeRadius : 28,
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: isExtended ? 20 : 16,
              vertical: 16,
            ),
            child: isExtended
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, color: ThemeColors.neutralWhite),
                      SizedBox(width: ThemeDimensions.smallPadding),
                      Text(
                        text,
                        style: ThemeTextStyles.bodyLarge.copyWith(
                          color: ThemeColors.neutralWhite,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  )
                : Icon(icon, color: ThemeColors.neutralWhite),
          ),
        ),
      ),
    );
  }
}
