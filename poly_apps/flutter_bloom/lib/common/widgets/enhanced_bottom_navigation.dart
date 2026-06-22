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
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

// AI: Claude Code - Enhanced common bottom navigation based on better implementations
// Reason: Combines best features from AChatBottomNavigation (clean design, theme support) and HomeBottomNavigationBar (rounded design, center highlighting)
// Provides flexible navigation item configuration, proper theming, and accessibility support
// NOTICE TO OTHER AIs: This replaces app-specific bottom navigation implementations. Use this instead of creating new ones.
// Supports both standard and rounded designs. Maintains backward compatibility with existing navigation patterns.

class NavigationItem {
  final IconData icon;
  final IconData? activeIcon;
  final String? iconImage;
  final String? activeIconImage;
  final String label;
  final String route;
  final VoidCallback? onTap;
  final bool isCenter;
  final String? badge;
  final Color? badgeColor;

  const NavigationItem({
    required this.icon,
    this.activeIcon,
    this.iconImage,
    this.activeIconImage,
    required this.label,
    required this.route,
    this.onTap,
    this.isCenter = false,
    this.badge,
    this.badgeColor,
  });
}

class EnhancedBottomNavigation extends StatelessWidget {
  final int currentIndex;
  final List<NavigationItem> items;
  final Function(int)? onTap;
  final Color? backgroundColor;
  final Color? selectedItemColor;
  final Color? unselectedItemColor;
  final double? elevation;
  final bool showLabels;
  final bool useRoundedDesign;
  final EdgeInsetsGeometry? padding;
  final BorderRadius? borderRadius;

  const EnhancedBottomNavigation({
    super.key,
    required this.currentIndex,
    required this.items,
    this.onTap,
    this.backgroundColor,
    this.selectedItemColor,
    this.unselectedItemColor,
    this.elevation,
    this.showLabels = true,
    this.useRoundedDesign = false,
    this.padding,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    if (useRoundedDesign) {
      return _buildRoundedNavigation(context);
    } else {
      return _buildStandardNavigation(context);
    }
  }

  Widget _buildStandardNavigation(BuildContext context) {
    final theme = Theme.of(context);
    
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor ?? 
               theme.bottomNavigationBarTheme.backgroundColor ??
               theme.scaffoldBackgroundColor,
        boxShadow: elevation != null ? [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: elevation!,
            offset: const Offset(0, -2),
          ),
        ] : null,
      ),
      child: SafeArea(
        child: Padding(
          padding: padding ?? const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeDefault,
            vertical: ThemeDimensions.paddingSizeSmall,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: items.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return _buildStandardNavItem(context, item, index);
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildRoundedNavigation(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: padding ?? const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      child: Container(
        height: 65,
        decoration: BoxDecoration(
          borderRadius: borderRadius ?? BorderRadius.circular(30),
          color: backgroundColor ?? (isDark ? ThemeColors.grey850 : ThemeColors.grey200),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: items.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            return _buildRoundedNavItem(context, item, index);
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildStandardNavItem(BuildContext context, NavigationItem item, int index) {
    final isActive = currentIndex == index;
    final theme = Theme.of(context);
    final defaultSelectedColor = selectedItemColor ?? theme.primaryColor;
    final defaultUnselectedColor = unselectedItemColor ?? theme.unselectedWidgetColor;

    final bool useImage = item.iconImage != null;
    final String? imageAsset = useImage
        ? (isActive ? (item.activeIconImage ?? item.iconImage) : item.iconImage)
        : null;

    return Expanded(
      child: Material(
        color: ThemeColors.transparent,
        child: InkWell(
          onTap: () => _handleItemTap(context, item, index),
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              vertical: ThemeDimensions.paddingSizeSmall,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    if (imageAsset != null)
                      Image.asset(
                        imageAsset,
                        height: 24,
                        fit: BoxFit.fitHeight,
                        errorBuilder: (_, __, ___) => Icon(
                          item.icon,
                          color: isActive ? defaultSelectedColor : defaultUnselectedColor,
                          size: ThemeDimensions.iconSizeMedium,
                        ),
                      )
                    else
                      Icon(
                        isActive ? (item.activeIcon ?? item.icon) : item.icon,
                        color: isActive ? defaultSelectedColor : defaultUnselectedColor,
                        size: ThemeDimensions.iconSizeMedium,
                      ),
                    if (item.badge != null)
                      Positioned(
                        top: -4,
                        right: -8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 2.0),
                          decoration: BoxDecoration(
                            color: item.badgeColor ?? Colors.red,
                            borderRadius: BorderRadius.circular(8.0),
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 16,
                            minHeight: 12,
                          ),
                          child: Text(
                            item.badge!,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8.0,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                ),
                if (showLabels) ...[
                  SizedBox(height: ThemeDimensions.spacing4),
                  Text(
                    item.label.tr(context),
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: isActive ? defaultSelectedColor : defaultUnselectedColor,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoundedNavItem(BuildContext context, NavigationItem item, int index) {
    final isActive = currentIndex == index;
    final isCenter = item.isCenter;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    final Color focusHomeColor = isDark ? theme.colorScheme.surface : ThemeColors.transparent;
    final Color focusCenterBaseColor = isDark ? theme.colorScheme.outline : theme.dividerColor;
    
    Color focusColor = ThemeColors.transparent;
    if (isCenter) {
      focusColor = focusCenterBaseColor;
    } else if (isActive) {
      focusColor = focusHomeColor;
    }

    final Color baseIconColor = isDark ? theme.colorScheme.error : ThemeColors.black87;
    final Color centerIconColor = isDark ? theme.colorScheme.error : ThemeColors.black;
    final Color selectedIconColor = selectedItemColor ?? (isDark ? theme.colorScheme.error : theme.primaryColorDark);
    
    Color iconColor = baseIconColor;
    if (isCenter) {
      iconColor = centerIconColor;
    } else if (isActive) {
      iconColor = selectedIconColor;
    }
    
    final double iconSize = isCenter ? 50 : 40;

    final bool useImage = item.iconImage != null;
    final String? imageAsset = useImage
        ? (isActive ? (item.activeIconImage ?? item.iconImage) : item.iconImage)
        : null;

    return Expanded(
      child: InkWell(
        highlightColor: ThemeColors.transparent,
        hoverColor: ThemeColors.transparent,
        onTap: () => _handleItemTap(context, item, index),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Center(
            child: Container(
              height: iconSize,
              width: iconSize,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: focusColor,
              ),
              child: imageAsset != null
                  ? Padding(
                      padding: const EdgeInsets.all(6),
                      child: Image.asset(
                        imageAsset,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Icon(
                          item.icon,
                          size: isCenter
                              ? ThemeDimensions.iconSizeXXL
                              : ThemeDimensions.iconSizeXL,
                          color: iconColor,
                        ),
                      ),
                    )
                  : Icon(
                isActive ? (item.activeIcon ?? item.icon) : item.icon,
                size: isCenter
                    ? ThemeDimensions.iconSizeXXL
                    : ThemeDimensions.iconSizeXL,
                color: iconColor,
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _handleItemTap(BuildContext context, NavigationItem item, int index) {
    if (item.onTap != null) {
      item.onTap!();
    } else if (onTap != null) {
      onTap!(index);
    } else {
      context.go(item.route);
    }
  }
}