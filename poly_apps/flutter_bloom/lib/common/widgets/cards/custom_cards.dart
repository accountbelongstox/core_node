import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Standard card with custom styling
class StyledCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;
  final double? elevation;
  final BorderRadius? borderRadius;
  final Border? border;
  final VoidCallback? onTap;

  const StyledCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.backgroundColor,
    this.elevation,
    this.borderRadius,
    this.border,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final card = Card(
      elevation: elevation ?? 2,
      color: backgroundColor ?? ThemeColors.neutralWhite,
      margin: margin ?? EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: borderRadius ?? BorderRadius.circular(
          ThemeDimensions.defaultRadius,
        ),
        side: border?.top ?? BorderSide.none,
      ),
      child: Padding(
        padding: padding ?? EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: child,
      ),
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: borderRadius ?? BorderRadius.circular(
          ThemeDimensions.defaultRadius,
        ),
        child: card,
      );
    }

    return card;
  }
}

/// Gradient card with custom colors
class GradientCard extends StatelessWidget {
  final Widget child;
  final List<Color>? gradientColors;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final VoidCallback? onTap;
  final AlignmentGeometry? gradientBegin;
  final AlignmentGeometry? gradientEnd;

  const GradientCard({
    super.key,
    required this.child,
    this.gradientColors,
    this.padding,
    this.margin,
    this.borderRadius,
    this.onTap,
    this.gradientBegin,
    this.gradientEnd,
  });

  @override
  Widget build(BuildContext context) {
    final colors = gradientColors ?? [
      ThemeColors.primaryBlue,
      ThemeColors.accentPurple,
    ];

    final container = Container(
      margin: margin,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: colors,
          begin: gradientBegin ?? Alignment.topLeft,
          end: gradientEnd ?? Alignment.bottomRight,
        ),
        borderRadius: borderRadius ?? BorderRadius.circular(
          ThemeDimensions.defaultRadius,
        ),
        boxShadow: [
          BoxShadow(
            color: colors.first.withOpacity(0.3),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
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
          borderRadius: borderRadius ?? BorderRadius.circular(
            ThemeDimensions.defaultRadius,
          ),
          child: container,
        ),
      );
    }

    return container;
  }
}

/// Info card with icon and description
class InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color? iconColor;
  final Color? backgroundColor;
  final VoidCallback? onTap;

  const InfoCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.iconColor,
    this.backgroundColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? ThemeColors.primaryBlue;

    return StyledCard(
      backgroundColor: backgroundColor,
      onTap: onTap,
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(
                ThemeDimensions.defaultRadius,
              ),
            ),
            child: Icon(
              icon,
              color: color,
              size: 32,
            ),
          ),
          SizedBox(width: ThemeDimensions.defaultPadding),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: ThemeDimensions.tinyPadding),
                Text(
                  description,
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ThemeColors.neutralGrey,
                  ),
                ),
              ],
            ),
          ),
          if (onTap != null)
            Icon(
              Icons.chevron_right,
              color: ThemeColors.neutralGrey,
            ),
        ],
      ),
    );
  }
}

/// Stat card for displaying statistics
class StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? color;
  final VoidCallback? onTap;

  const StatCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cardColor = color ?? ThemeColors.primaryBlue;

    return StyledCard(
      backgroundColor: cardColor.withOpacity(0.1),
      border: Border.all(
        color: cardColor.withOpacity(0.3),
      ),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            color: cardColor,
            size: 32,
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            value,
            style: ThemeTextStyles.headlineMedium.copyWith(
              color: cardColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.tinyPadding),
          Text(
            label,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralGrey,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// Feature card with image
class FeatureCard extends StatelessWidget {
  final String imageUrl;
  final String title;
  final String? subtitle;
  final Widget? badge;
  final Widget? footer;
  final VoidCallback? onTap;
  final double? height;

  const FeatureCard({
    super.key,
    required this.imageUrl,
    required this.title,
    this.subtitle,
    this.badge,
    this.footer,
    this.onTap,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Image.network(
                  imageUrl,
                  height: height ?? 150,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: height ?? 150,
                      color: ThemeColors.neutralGrey.withOpacity(0.2),
                      child: Icon(
                        Icons.image,
                        size: 48,
                        color: ThemeColors.neutralGrey,
                      ),
                    );
                  },
                ),
                if (badge != null)
                  Positioned(
                    top: ThemeDimensions.smallPadding,
                    right: ThemeDimensions.smallPadding,
                    child: badge!,
                  ),
              ],
            ),
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: ThemeTextStyles.headlineSmall.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null) ...[
                    SizedBox(height: ThemeDimensions.tinyPadding),
                    Text(
                      subtitle!,
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: ThemeColors.neutralGrey,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (footer != null) ...[
                    SizedBox(height: ThemeDimensions.smallPadding),
                    footer!,
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pricing card for membership tiers
class PricingCard extends StatelessWidget {
  final String title;
  final String price;
  final String period;
  final List<String> features;
  final bool isPopular;
  final Color? color;
  final VoidCallback? onSelect;

  const PricingCard({
    super.key,
    required this.title,
    required this.price,
    required this.period,
    required this.features,
    this.isPopular = false,
    this.color,
    this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final cardColor = color ?? ThemeColors.primaryBlue;

    return Container(
      decoration: BoxDecoration(
        border: Border.all(
          color: isPopular ? cardColor : ThemeColors.neutralGrey.withOpacity(0.3),
          width: isPopular ? 3 : 1,
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (isPopular)
            Container(
              padding: EdgeInsets.symmetric(
                vertical: ThemeDimensions.tinyPadding,
              ),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(ThemeDimensions.defaultRadius - 3),
                  topRight: Radius.circular(ThemeDimensions.defaultRadius - 3),
                ),
              ),
              child: Text(
                'POPULAR',
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.neutralWhite,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          Padding(
            padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    fontWeight: FontWeight.bold,
                    color: cardColor,
                  ),
                ),
                SizedBox(height: ThemeDimensions.smallPadding),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      price,
                      style: ThemeTextStyles.displayMedium.copyWith(
                        fontWeight: FontWeight.bold,
                        color: cardColor,
                      ),
                    ),
                    SizedBox(width: ThemeDimensions.tinyPadding),
                    Padding(
                      padding: EdgeInsets.only(
                        bottom: ThemeDimensions.smallPadding,
                      ),
                      child: Text(
                        period,
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ThemeColors.neutralGrey,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: ThemeDimensions.largePadding),
                ...features.map((feature) {
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: ThemeDimensions.smallPadding,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.check_circle,
                          size: 20,
                          color: cardColor,
                        ),
                        SizedBox(width: ThemeDimensions.smallPadding),
                        Expanded(
                          child: Text(
                            feature,
                            style: ThemeTextStyles.bodyMedium,
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                SizedBox(height: ThemeDimensions.defaultPadding),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onSelect,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isPopular
                          ? cardColor
                          : ThemeColors.neutralWhite,
                      foregroundColor: isPopular
                          ? ThemeColors.neutralWhite
                          : cardColor,
                      side: BorderSide(color: cardColor),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          ThemeDimensions.defaultRadius,
                        ),
                      ),
                    ),
                    child: Text('Select'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
