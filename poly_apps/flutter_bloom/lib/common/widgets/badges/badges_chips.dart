import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Status badge widget
class StatusBadge extends StatelessWidget {
  final String text;
  final Color? backgroundColor;
  final Color? textColor;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.text,
    this.backgroundColor,
    this.textColor,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final bgColor = backgroundColor ?? ThemeColors.primaryBlue;
    final fgColor = textColor ?? ThemeColors.neutralWhite;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.smallPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(ThemeDimensions.smallRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 14,
              color: fgColor,
            ),
            SizedBox(width: ThemeDimensions.tinyPadding),
          ],
          Text(
            text,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: fgColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

/// Outlined badge
class OutlinedBadge extends StatelessWidget {
  final String text;
  final Color? borderColor;
  final Color? textColor;
  final IconData? icon;

  const OutlinedBadge({
    super.key,
    required this.text,
    this.borderColor,
    this.textColor,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final color = borderColor ?? ThemeColors.primaryBlue;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.smallPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      decoration: BoxDecoration(
        border: Border.all(
          color: color,
          width: 1.5,
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.smallRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 14,
              color: textColor ?? color,
            ),
            SizedBox(width: ThemeDimensions.tinyPadding),
          ],
          Text(
            text,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: textColor ?? color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

/// VIP badge with gold styling
class VipBadge extends StatelessWidget {
  final String? text;

  const VipBadge({
    super.key,
    this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.smallPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            ThemeColors.accentGold,
            Color(0xFFFFD700),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.smallRadius),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.accentGold.withOpacity(0.3),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.stars,
            size: 14,
            color: ThemeColors.neutralWhite,
          ),
          SizedBox(width: ThemeDimensions.tinyPadding),
          Text(
            text ?? 'VIP',
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralWhite,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

/// Notification badge (dot indicator)
class NotificationBadge extends StatelessWidget {
  final int? count;
  final Color? color;
  final double? size;

  const NotificationBadge({
    super.key,
    this.count,
    this.color,
    this.size,
  });

  @override
  Widget build(BuildContext context) {
    final badgeSize = size ?? 20.0;
    final badgeColor = color ?? ThemeColors.errorRed;

    if (count == null || count == 0) {
      return Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: badgeColor,
          shape: BoxShape.circle,
        ),
      );
    }

    return Container(
      constraints: BoxConstraints(
        minWidth: badgeSize,
        minHeight: badgeSize,
      ),
      padding: EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: badgeColor,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          count! > 99 ? '99+' : count.toString(),
          style: ThemeTextStyles.bodySmall.copyWith(
            color: ThemeColors.neutralWhite,
            fontWeight: FontWeight.bold,
            fontSize: 10,
          ),
        ),
      ),
    );
  }
}

/// Selectable chip
class SelectableChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback? onTap;
  final IconData? icon;
  final Color? selectedColor;

  const SelectableChip({
    super.key,
    required this.label,
    required this.isSelected,
    this.onTap,
    this.icon,
    this.selectedColor,
  });

  @override
  Widget build(BuildContext context) {
    final color = selectedColor ?? ThemeColors.primaryBlue;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.defaultPadding,
          vertical: ThemeDimensions.smallPadding,
        ),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.transparent,
          border: Border.all(
            color: isSelected ? color : ThemeColors.neutralGrey.withOpacity(0.3),
          ),
          borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 16,
                color: isSelected
                    ? ThemeColors.neutralWhite
                    : ThemeColors.neutralGrey,
              ),
              SizedBox(width: ThemeDimensions.tinyPadding),
            ],
            Text(
              label,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: isSelected
                    ? ThemeColors.neutralWhite
                    : ThemeColors.neutralBlack,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Filter chip
class FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback? onTap;
  final Color? color;

  const FilterChip({
    super.key,
    required this.label,
    required this.isSelected,
    this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? ThemeColors.primaryBlue;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(ThemeDimensions.smallRadius),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.smallPadding,
          vertical: ThemeDimensions.tinyPadding,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? chipColor.withOpacity(0.2)
              : ThemeColors.neutralGrey.withOpacity(0.1),
          borderRadius: BorderRadius.circular(ThemeDimensions.smallRadius),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isSelected)
              Icon(
                Icons.check,
                size: 14,
                color: chipColor,
              ),
            if (isSelected)
              SizedBox(width: ThemeDimensions.tinyPadding),
            Text(
              label,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: isSelected ? chipColor : ThemeColors.neutralGrey,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
