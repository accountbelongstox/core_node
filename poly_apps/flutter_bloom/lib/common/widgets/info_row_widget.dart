import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Common Info Row Widget
/// 
/// A reusable widget for displaying key-value pairs with optional tap action
/// Used across different apps for consistent information display
class InfoRowWidget extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback? onTap;
  final bool showArrow;
  final EdgeInsetsGeometry? padding;
  final Color? labelColor;
  final Color? valueColor;
  final TextStyle? labelStyle;
  final TextStyle? valueStyle;

  const InfoRowWidget({
    super.key,
    required this.label,
    required this.value,
    this.onTap,
    this.showArrow = true,
    this.padding,
    this.labelColor,
    this.valueColor,
    this.labelStyle,
    this.valueStyle,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: padding ?? EdgeInsets.symmetric(
          vertical: ThemeDimensions.spacingMedium,
          horizontal: ThemeDimensions.spacingSmall,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: labelStyle ?? ThemeTextStyles.bodyLarge.copyWith(
                color: labelColor ?? ThemeColors.textSecondary,
              ),
            ),
            Row(
              children: [
                Text(
                  value,
                  style: valueStyle ?? ThemeTextStyles.bodyLarge.copyWith(
                    color: valueColor ?? ThemeColors.textPrimary,
                  ),
                ),
                if (showArrow && onTap != null) ...[
                  SizedBox(width: ThemeDimensions.spacingSmall),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 16,
                    color: ThemeColors.textSecondary,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
