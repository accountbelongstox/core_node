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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

/// Bank Bottom Navigation Bar
/// 
/// A specialized bottom navigation bar designed specifically for banking applications
/// Based on the design pattern shown in the reference image with 5 main sections:
/// - Home (首页)
/// - Credit Card (信用卡) 
/// - Wealth (财富) - Currently selected
/// - Life (生活)
/// - My/Profile (我的)
/// 
/// DESIGN FEATURES:
/// - Clean, modern design with proper spacing
/// - Blue highlight for selected item
/// - Consistent with banking app UI patterns
/// - Supports both Chinese and English labels
/// - Responsive design for different screen sizes
class BankBottomNavigation extends StatelessWidget {
  final int currentIndex;
  final Function(int)? onTap;
  final Color? backgroundColor;
  final Color? selectedItemColor;
  final Color? unselectedItemColor;
  final double? elevation;
  final bool showLabels;
  final EdgeInsetsGeometry? padding;

  const BankBottomNavigation({
    super.key,
    required this.currentIndex,
    this.onTap,
    this.backgroundColor,
    this.selectedItemColor,
    this.unselectedItemColor,
    this.elevation,
    this.showLabels = true,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor ?? 
               (isDark ? ThemeColors.grey900 : Colors.white),
        boxShadow: elevation != null ? [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: elevation!,
            offset: const Offset(0, -2),
          ),
        ] : [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: padding ?? const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingMedium,
            vertical: 3.0,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: _buildNavigationItems(context, isDark),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildNavigationItems(BuildContext context, bool isDark) {
    final items = _getNavigationItems();
    
    return items.asMap().entries.map((entry) {
      final index = entry.key;
      final item = entry.value;
      return _buildNavigationItem(context, item, index, isDark);
    }).toList();
  }

  Widget _buildNavigationItem(BuildContext context, BankNavigationItem item, int index, bool isDark) {
    final isActive = currentIndex == index;
    final itemSelectedColor = item.selectedColor ?? (selectedItemColor ?? ThemeColors.primaryColor);
    final itemUnselectedColor = item.unselectedColor ?? (unselectedItemColor ?? 
                           (isDark ? ThemeColors.grey400 : ThemeColors.grey600));
    final iconColor = isActive ? itemSelectedColor : itemUnselectedColor;

    return Expanded(
      child: Material(
        color: ThemeColors.transparent,
        child: InkWell(
          onTap: () => _handleItemTap(context, item, index),
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
          hoverColor: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              vertical: ThemeDimensions.paddingSmall,
              horizontal: ThemeDimensions.paddingSizeExtraSmall,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isActive ? (item.activeIcon ?? item.icon) : item.icon,
                  color: iconColor,
                  size: 28, // Increased from ThemeDimensions.iconSizeMedium
                ),
                if (showLabels) ...[
                  const SizedBox(height: ThemeDimensions.spacing4),
                  Text(
                    item.label,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: isActive ? itemSelectedColor : itemUnselectedColor,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                      fontSize: 16, // Increased from 12
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

  void _handleItemTap(BuildContext context, BankNavigationItem item, int index) {
    if (item.onTap != null) {
      item.onTap!();
    } else if (onTap != null) {
      onTap!(index);
    } else if (item.route.isNotEmpty) {
      context.go(item.route);
    }
  }

  List<BankNavigationItem> _getNavigationItems() {
    return [
      BankNavigationItem(
        icon: Icons.home_outlined,
        activeIcon: Icons.home,
        label: '首页',
        route: '/bank/dashboard',
        selectedColor: const Color(0xFF1890FF),
        unselectedColor: const Color(0xFF8C8C8C),
      ),
      BankNavigationItem(
        icon: Icons.credit_card_outlined,
        activeIcon: Icons.credit_card,
        label: '信用卡',
        route: '/bank/card_management',
        selectedColor: const Color(0xFF1AA5CE),
        unselectedColor: const Color(0xFF8C8C8C),
      ),
      BankNavigationItem(
        icon: Icons.account_balance_wallet_outlined,
        activeIcon: Icons.account_balance_wallet,
        label: '财富',
        route: '/bank/investment',
        selectedColor: const Color(0xFFD68915),
        unselectedColor: const Color(0xFF8C8C8C),
      ),
      BankNavigationItem(
        icon: Icons.local_cafe_outlined,
        activeIcon: Icons.local_cafe,
        label: '生活',
        route: '/bank/life',
        selectedColor: const Color(0xFFFF6B35),
        unselectedColor: const Color(0xFF8C8C8C),
      ),
      BankNavigationItem(
        // Primary: Smile face icon (emoji_emotions)
        // Alternative options:
        // - Icons.mood / Icons.mood_outlined (happy mood icon)
        // - Icons.sentiment_satisfied / Icons.sentiment_satisfied_outlined (satisfied face)
        // - Icons.sentiment_very_satisfied / Icons.sentiment_very_satisfied_outlined (very satisfied face)
        // - Icons.face / Icons.face_outlined (generic face icon)
        // - Icons.account_circle / Icons.account_circle_outlined (circle with person, more traditional)
        icon: Icons.emoji_emotions_outlined,
        activeIcon: Icons.emoji_emotions,
        label: '我的',
        route: '/bank/profile',
        selectedColor: const Color(0xFF879ADF),
        unselectedColor: const Color(0xFF8C8C8C),
      ),
    ];
  }
}

/// Bank Navigation Item
/// 
/// Represents a single navigation item in the bank bottom navigation bar
class BankNavigationItem {
  final IconData? icon;
  final IconData? activeIcon;
  final String? imagePath;
  final String? activeImagePath;
  final String label;
  final String route;
  final VoidCallback? onTap;
  final Color? selectedColor;
  final Color? unselectedColor;
  final Color? backgroundColor;
  final double? backgroundRadius;

  const BankNavigationItem({
    this.icon,
    this.activeIcon,
    this.imagePath,
    this.activeImagePath,
    required this.label,
    required this.route,
    this.onTap,
    this.selectedColor,
    this.unselectedColor,
    this.backgroundColor,
    this.backgroundRadius,
  }) : assert(
          (icon != null || imagePath != null),
          'Either icon or imagePath must be provided',
        );
}

/// Bank Bottom Navigation with Custom Items
/// 
/// Allows customization of navigation items for different banking apps
class CustomBankBottomNavigation extends StatelessWidget {
  final int currentIndex;
  final List<BankNavigationItem> items;
  final Function(int)? onTap;
  final Color? backgroundColor;
  final Color? selectedItemColor;
  final Color? unselectedItemColor;
  final double? elevation;
  final bool showLabels;
  final EdgeInsetsGeometry? padding;

  const CustomBankBottomNavigation({
    super.key,
    required this.currentIndex,
    required this.items,
    this.onTap,
    this.backgroundColor,
    this.selectedItemColor,
    this.unselectedItemColor,
    this.elevation,
    this.showLabels = true,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor ?? 
               (isDark ? ThemeColors.grey900 : Colors.white),
        boxShadow: elevation != null ? [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: elevation!,
            offset: const Offset(0, -2),
          ),
        ] : [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: padding ?? const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingMedium,
            vertical: 3.0,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: items.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return _buildNavigationItem(context, item, index, isDark);
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildNavigationItem(BuildContext context, BankNavigationItem item, int index, bool isDark) {
    final isActive = currentIndex == index;
    final selectedColor = selectedItemColor ?? ThemeColors.primaryColor;
    final unselectedColor = unselectedItemColor ?? 
                           (isDark ? ThemeColors.grey400 : ThemeColors.grey600);

    return Expanded(
      child: Material(
        color: ThemeColors.transparent,
        child: InkWell(
          onTap: () => _handleItemTap(context, item, index),
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
          hoverColor: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              vertical: 3.0,
              horizontal: ThemeDimensions.paddingSizeExtraSmall,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (item.imagePath != null)
                  Image.asset(
                    isActive
                        ? (item.activeImagePath ?? item.imagePath!)
                        : item.imagePath!,
                    width: 17,
                    height: 17,
                    fit: BoxFit.contain,
                  )
                else
                  Icon(
                    isActive ? (item.activeIcon ?? item.icon!) : item.icon!,
                    color: isActive ? selectedColor : unselectedColor,
                    size: 17,
                  ),
                if (showLabels) ...[
                  const SizedBox(height: 2),
                  Text(
                    item.label,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: isActive ? selectedColor : unselectedColor,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                      fontSize: 10,
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

  void _handleItemTap(BuildContext context, BankNavigationItem item, int index) {
    if (item.onTap != null) {
      item.onTap!();
    } else if (onTap != null) {
      onTap!(index);
    } else if (item.route.isNotEmpty) {
      context.go(item.route);
    }
  }
}
