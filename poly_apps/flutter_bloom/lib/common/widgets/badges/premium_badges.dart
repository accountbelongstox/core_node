import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_shadow.dart';
import 'package:qyflutter/common/theme/base/theme_gradients.dart';

class GradientBadge extends StatelessWidget {
  final String text;
  final LinearGradient? gradient;
  final IconData? icon;
  final EdgeInsetsGeometry? padding;
  final TextStyle? textStyle;

  const GradientBadge({
    super.key,
    required this.text,
    this.gradient,
    this.icon,
    this.padding,
    this.textStyle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ??
          EdgeInsets.symmetric(
            horizontal: ThemeDimensions.smallPadding,
            vertical: ThemeDimensions.tinyPadding,
          ),
      decoration: BoxDecoration(
        gradient: gradient ?? ThemeGradients.primaryBlue,
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        boxShadow: ThemeShadow.small,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 14,
              color: ThemeColors.neutralWhite,
            ),
            SizedBox(width: 4),
          ],
          Text(
            text,
            style: textStyle ??
                ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.neutralWhite,
                  fontWeight: FontWeight.bold,
                ),
          ),
        ],
      ),
    );
  }
}

class VipBadge extends StatelessWidget {
  final String tier;
  final String? text;
  final IconData? icon;
  final double size;

  const VipBadge({
    super.key,
    required this.tier,
    this.text,
    this.icon,
    this.size = 24.0,
  });

  @override
  Widget build(BuildContext context) {
    final gradient = ThemeGradients.getVipTierGradient(tier);
    final displayText = text ?? tier.toUpperCase();

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: size * 0.4,
        vertical: size * 0.2,
      ),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(size * 0.3),
        boxShadow: ThemeShadow.getColoredShadow(
          gradient.colors.first,
          opacity: 0.4,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: size * 0.6,
              color: ThemeColors.neutralWhite,
            ),
            SizedBox(width: size * 0.2),
          ],
          Text(
            displayText,
            style: TextStyle(
              fontSize: size * 0.5,
              fontWeight: FontWeight.bold,
              color: ThemeColors.neutralWhite,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class GlowBadge extends StatelessWidget {
  final String text;
  final Color glowColor;
  final IconData? icon;
  final double glowIntensity;

  const GlowBadge({
    super.key,
    required this.text,
    required this.glowColor,
    this.icon,
    this.glowIntensity = 0.5,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.smallPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      decoration: BoxDecoration(
        color: glowColor.withOpacity(0.2),
        border: Border.all(color: glowColor, width: 1.5),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        boxShadow: ThemeShadow.getGlowShadow(
          glowColor,
          intensity: glowIntensity,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 14,
              color: glowColor,
            ),
            SizedBox(width: 4),
          ],
          Text(
            text,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: glowColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class PremiumTag extends StatelessWidget {
  final String text;
  final Color? backgroundColor;
  final Color? textColor;
  final IconData? icon;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  const PremiumTag({
    super.key,
    required this.text,
    this.backgroundColor,
    this.textColor,
    this.icon,
    this.onTap,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor ?? ThemeColors.primaryBlue.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        border: Border.all(
          color: backgroundColor ?? ThemeColors.primaryBlue,
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.smallPadding,
              vertical: ThemeDimensions.tinyPadding,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(
                    icon,
                    size: 14,
                    color: textColor ?? ThemeColors.primaryBlue,
                  ),
                  SizedBox(width: 4),
                ],
                Text(
                  text,
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: textColor ?? ThemeColors.primaryBlue,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (onDelete != null) ...[
                  SizedBox(width: 4),
                  GestureDetector(
                    onTap: onDelete,
                    child: Icon(
                      Icons.close,
                      size: 14,
                      color: textColor ?? ThemeColors.primaryBlue,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class CountBadge extends StatelessWidget {
  final int count;
  final Color? backgroundColor;
  final Color? textColor;
  final double size;
  final bool showZero;

  const CountBadge({
    super.key,
    required this.count,
    this.backgroundColor,
    this.textColor,
    this.size = 20.0,
    this.showZero = false,
  });

  @override
  Widget build(BuildContext context) {
    if (count == 0 && !showZero) {
      return const SizedBox.shrink();
    }

    final displayCount = count > 99 ? '99+' : count.toString();

    return Container(
      constraints: BoxConstraints(
        minWidth: size,
        minHeight: size,
      ),
      padding: EdgeInsets.all(size * 0.15),
      decoration: BoxDecoration(
        color: backgroundColor ?? ThemeColors.errorRed,
        shape: BoxShape.circle,
        boxShadow: ThemeShadow.small,
      ),
      child: Center(
        child: Text(
          displayCount,
          style: TextStyle(
            fontSize: size * 0.5,
            fontWeight: FontWeight.bold,
            color: textColor ?? ThemeColors.neutralWhite,
          ),
        ),
      ),
    );
  }
}

class StatusDot extends StatelessWidget {
  final Color color;
  final double size;
  final bool animated;

  const StatusDot({
    super.key,
    required this.color,
    this.size = 8.0,
    this.animated = false,
  });

  @override
  Widget build(BuildContext context) {
    if (animated) {
      return TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.7, end: 1.0),
        duration: const Duration(milliseconds: 800),
        curve: Curves.easeInOut,
        builder: (context, value, child) {
          return Opacity(
            opacity: value,
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                boxShadow: ThemeShadow.getGlowShadow(color, intensity: 0.6),
              ),
            ),
          );
        },
        onEnd: () {},
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
    );
  }
}

class MetallicBadge extends StatelessWidget {
  final String text;
  final Color baseColor;
  final IconData? icon;

  const MetallicBadge({
    super.key,
    required this.text,
    this.baseColor = const Color(0xFFD4AF37),
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.smallPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      decoration: BoxDecoration(
        gradient: ThemeGradients.metal(baseColor: baseColor),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        border: Border.all(
          color: baseColor.withOpacity(0.5),
          width: 1,
        ),
        boxShadow: ThemeShadow.getColoredShadow(baseColor, opacity: 0.3),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 14,
              color: ThemeColors.neutralWhite,
            ),
            SizedBox(width: 4),
          ],
          Text(
            text,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralWhite,
              fontWeight: FontWeight.bold,
              shadows: [
                Shadow(
                  color: Colors.black.withOpacity(0.3),
                  offset: const Offset(0, 1),
                  blurRadius: 2,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class AnimatedCountBadge extends StatefulWidget {
  final int count;
  final Color? backgroundColor;
  final Color? textColor;
  final double size;

  const AnimatedCountBadge({
    super.key,
    required this.count,
    this.backgroundColor,
    this.textColor,
    this.size = 20.0,
  });

  @override
  State<AnimatedCountBadge> createState() => _AnimatedCountBadgeState();
}

class _AnimatedCountBadgeState extends State<AnimatedCountBadge>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  int _previousCount = 0;

  @override
  void initState() {
    super.initState();
    _previousCount = widget.count;
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
  }

  @override
  void didUpdateWidget(AnimatedCountBadge oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.count != _previousCount) {
      _previousCount = widget.count;
      _controller.forward(from: 0.0).then((_) {
        if (mounted) {
          _controller.reverse();
        }
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.count == 0) {
      return const SizedBox.shrink();
    }

    return ScaleTransition(
      scale: _scaleAnimation,
      child: CountBadge(
        count: widget.count,
        backgroundColor: widget.backgroundColor,
        textColor: widget.textColor,
        size: widget.size,
      ),
    );
  }
}
