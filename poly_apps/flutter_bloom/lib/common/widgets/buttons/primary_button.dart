import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Primary button with gradient background
class PrimaryButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double? height;
  final double? width;
  final EdgeInsetsGeometry? padding;
  final BorderRadius? borderRadius;

  const PrimaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.backgroundColor,
    this.foregroundColor,
    this.height,
    this.width,
    this.padding,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final buttonHeight = height ?? 56.0;
    final buttonWidth = isFullWidth ? double.infinity : width;

    return SizedBox(
      height: buttonHeight,
      width: buttonWidth,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor ?? ThemeColors.primaryBlue,
          foregroundColor: foregroundColor ?? ThemeColors.neutralWhite,
          disabledBackgroundColor: ThemeColors.neutralGrey.withOpacity(0.3),
          padding: padding ?? EdgeInsets.symmetric(
            horizontal: ThemeDimensions.defaultPadding,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: borderRadius ?? BorderRadius.circular(
              ThemeDimensions.defaultRadius,
            ),
          ),
          elevation: 2,
        ),
        child: isLoading
            ? SizedBox(
                height: 24,
                width: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    foregroundColor ?? ThemeColors.neutralWhite,
                  ),
                ),
              )
            : icon != null
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon, size: 20),
                      SizedBox(width: ThemeDimensions.smallPadding),
                      Text(
                        text,
                        style: ThemeTextStyles.bodyLarge.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  )
                : Text(
                    text,
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
      ),
    );
  }
}

/// Gradient button with custom gradient colors
class GradientButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final List<Color>? gradientColors;
  final double? height;
  final double? width;

  const GradientButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.gradientColors,
    this.height,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    final buttonHeight = height ?? 56.0;
    final buttonWidth = isFullWidth ? double.infinity : width;
    final colors = gradientColors ?? [
      ThemeColors.primaryBlue,
      ThemeColors.accentPurple,
    ];

    return SizedBox(
      height: buttonHeight,
      width: buttonWidth,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: onPressed == null && !isLoading
                ? [
                    ThemeColors.neutralGrey.withOpacity(0.3),
                    ThemeColors.neutralGrey.withOpacity(0.3),
                  ]
                : colors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          boxShadow: [
            if (onPressed != null && !isLoading)
              BoxShadow(
                color: colors.first.withOpacity(0.3),
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: isLoading ? null : onPressed,
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
            child: Center(
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
                              color: ThemeColors.neutralWhite,
                              size: 20,
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

/// Secondary outlined button
class SecondaryButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final Color? borderColor;
  final Color? textColor;
  final double? height;

  const SecondaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.borderColor,
    this.textColor,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    final buttonHeight = height ?? 56.0;
    final color = borderColor ?? ThemeColors.primaryBlue;

    return SizedBox(
      height: buttonHeight,
      width: isFullWidth ? double.infinity : null,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: textColor ?? color,
          side: BorderSide(
            color: onPressed == null && !isLoading
                ? ThemeColors.neutralGrey.withOpacity(0.3)
                : color,
            width: 2,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          ),
        ),
        child: isLoading
            ? SizedBox(
                height: 24,
                width: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              )
            : icon != null
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon, size: 20),
                      SizedBox(width: ThemeDimensions.smallPadding),
                      Text(
                        text,
                        style: ThemeTextStyles.bodyLarge.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  )
                : Text(
                    text,
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
      ),
    );
  }
}

/// Icon button with background
class IconActionButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final Color? backgroundColor;
  final Color? iconColor;
  final double? size;
  final String? tooltip;

  const IconActionButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.backgroundColor,
    this.iconColor,
    this.size,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final buttonSize = size ?? 48.0;
    final bgColor = backgroundColor ?? ThemeColors.primaryBlue;
    final fgColor = iconColor ?? ThemeColors.neutralWhite;

    final button = Container(
      width: buttonSize,
      height: buttonSize,
      decoration: BoxDecoration(
        color: onPressed == null
            ? ThemeColors.neutralGrey.withOpacity(0.3)
            : bgColor,
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        boxShadow: [
          if (onPressed != null)
            BoxShadow(
              color: bgColor.withOpacity(0.3),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          child: Icon(
            icon,
            color: fgColor,
            size: buttonSize * 0.5,
          ),
        ),
      ),
    );

    if (tooltip != null) {
      return Tooltip(
        message: tooltip!,
        child: button,
      );
    }

    return button;
  }
}

/// Floating action button with custom style
class FloatingButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final Color? backgroundColor;
  final Color? iconColor;
  final double? size;
  final String? tooltip;

  const FloatingButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.backgroundColor,
    this.iconColor,
    this.size,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final buttonSize = size ?? 56.0;
    final bgColor = backgroundColor ?? ThemeColors.primaryBlue;

    return FloatingActionButton(
      onPressed: onPressed,
      backgroundColor: bgColor,
      foregroundColor: iconColor ?? ThemeColors.neutralWhite,
      tooltip: tooltip,
      elevation: 6,
      child: Icon(icon, size: buttonSize * 0.5),
    );
  }
}
