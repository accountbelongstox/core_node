import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_gradients.dart';
import 'package:qyflutter/common/theme/base/theme_effects.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;
  final double opacity;
  final double blurAmount;
  final BorderRadius? borderRadius;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.backgroundColor,
    this.opacity = 0.2,
    this.blurAmount = 10.0,
    this.borderRadius,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      margin: margin,
      decoration: ThemeEffects.glassmorphism(
        color: backgroundColor ?? Colors.white,
        opacity: opacity,
        blurAmount: blurAmount,
        borderRadius: borderRadius,
      ),
      child: ClipRRect(
        borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: blurAmount,
            sigmaY: blurAmount,
          ),
          child: Padding(
            padding: padding ?? EdgeInsets.all(ThemeDimensions.defaultPadding),
            child: child,
          ),
        ),
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
          child: content,
        ),
      );
    }

    return content;
  }
}

class MetallicCard extends StatelessWidget {
  final Widget child;
  final Color baseColor;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final VoidCallback? onTap;

  const MetallicCard({
    super.key,
    required this.child,
    this.baseColor = const Color(0xFFD4AF37),
    this.padding,
    this.margin,
    this.borderRadius,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      margin: margin,
      decoration: ThemeEffects.metallicSheen(
        baseColor: baseColor,
        borderRadius: borderRadius,
      ),
      child: Padding(
        padding: padding ?? EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: child,
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
          child: content,
        ),
      );
    }

    return content;
  }
}

class PremiumGradientCard extends StatelessWidget {
  final Widget child;
  final LinearGradient? gradient;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final VoidCallback? onTap;
  final bool elevated;

  const PremiumGradientCard({
    super.key,
    required this.child,
    this.gradient,
    this.padding,
    this.margin,
    this.borderRadius,
    this.onTap,
    this.elevated = true,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      margin: margin,
      decoration: ThemeEffects.premiumCard(
        gradient: gradient,
        borderRadius: borderRadius,
        elevated: elevated,
      ),
      child: Padding(
        padding: padding ?? EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: child,
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
          child: content,
        ),
      );
    }

    return content;
  }
}

class VipTierCard extends StatelessWidget {
  final String tier;
  final String title;
  final String subtitle;
  final String price;
  final List<String> features;
  final VoidCallback? onTap;
  final bool isSelected;
  final Widget? badge;

  const VipTierCard({
    super.key,
    required this.tier,
    required this.title,
    required this.subtitle,
    required this.price,
    required this.features,
    this.onTap,
    this.isSelected = false,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    final gradient = ThemeGradients.getVipTierGradient(tier);

    return PremiumGradientCard(
      gradient: gradient,
      onTap: onTap,
      elevated: isSelected,
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title,
                    style: ThemeTextStyles.headlineMedium.copyWith(
                      color: ThemeColors.neutralWhite,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (badge != null) badge!,
                ],
              ),
              SizedBox(height: ThemeDimensions.tinyPadding),
              Text(
                subtitle,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ThemeColors.neutralWhite.withOpacity(0.9),
                ),
              ),
              SizedBox(height: ThemeDimensions.defaultPadding),
              Text(
                price,
                style: ThemeTextStyles.headlineLarge.copyWith(
                  color: ThemeColors.neutralWhite,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.defaultPadding),
              Divider(color: ThemeColors.neutralWhite.withOpacity(0.3)),
              SizedBox(height: ThemeDimensions.defaultPadding),
              ...features.map((feature) => Padding(
                    padding: EdgeInsets.only(
                      bottom: ThemeDimensions.smallPadding,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.check_circle,
                          size: 18,
                          color: ThemeColors.neutralWhite,
                        ),
                        SizedBox(width: ThemeDimensions.smallPadding),
                        Expanded(
                          child: Text(
                            feature,
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ThemeColors.neutralWhite,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )),
            ],
          ),
          if (isSelected)
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.smallPadding,
                  vertical: ThemeDimensions.tinyPadding,
                ),
                decoration: BoxDecoration(
                  color: ThemeColors.neutralWhite,
                  borderRadius: BorderRadius.circular(
                    ThemeDimensions.defaultRadius,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.check,
                      size: 14,
                      color: ThemeColors.primaryBlue,
                    ),
                    SizedBox(width: 4),
                    Text(
                      'Selected',
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: ThemeColors.primaryBlue,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class NeumorphicCard extends StatelessWidget {
  final Widget child;
  final Color? backgroundColor;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final bool isPressed;
  final VoidCallback? onTap;

  const NeumorphicCard({
    super.key,
    required this.child,
    this.backgroundColor,
    this.padding,
    this.margin,
    this.borderRadius,
    this.isPressed = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      margin: margin,
      decoration: ThemeEffects.neumorphism(
        backgroundColor: backgroundColor ?? const Color(0xFFE0E0E0),
        borderRadius: borderRadius,
        isPressed: isPressed,
      ),
      child: Padding(
        padding: padding ?? EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: child,
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
          child: content,
        ),
      );
    }

    return content;
  }
}

class ShimmerCard extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius? borderRadius;
  final Color baseColor;
  final Color highlightColor;

  const ShimmerCard({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius,
    this.baseColor = const Color(0xFFE0E0E0),
    this.highlightColor = const Color(0xFFF5F5F5),
  });

  @override
  State<ShimmerCard> createState() => _ShimmerCardState();
}

class _ShimmerCardState extends State<ShimmerCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: ThemeEffects.shimmerEffect(
            baseColor: widget.baseColor,
            highlightColor: widget.highlightColor,
            borderRadius: widget.borderRadius,
          ),
        );
      },
    );
  }
}

class ElevatedPremiumCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;
  final BorderRadius? borderRadius;
  final int elevation;
  final VoidCallback? onTap;

  const ElevatedPremiumCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.backgroundColor,
    this.borderRadius,
    this.elevation = 2,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      margin: margin,
      decoration: ThemeEffects.elevatedCard(
        backgroundColor: backgroundColor,
        borderRadius: borderRadius,
        elevation: elevation,
      ),
      child: Padding(
        padding: padding ?? EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: child,
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: borderRadius ?? ThemeDimensions.borderRadiusL,
          child: content,
        ),
      );
    }

    return content;
  }
}
