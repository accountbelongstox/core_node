// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../router_app_wuy/router_app_wuy.dart';
import '../localization_app_wuy/localization_keys_app_wuy.dart';

/// Wuy App Bottom Navigation Component
/// 
/// This is a Wuy app-specific bottom navigation component.
/// It provides consistent navigation across all Wuy app pages.
/// 
/// Features:
/// - Consistent styling with Wuy app theme
/// - Localization support
/// - Route-based navigation using GoRouter
/// - Active state indication
class WuyBottomNavigation extends StatelessWidget {
  final int currentIndex;
  final Function(int)? onTap;

  const WuyBottomNavigation({
    super.key,
    required this.currentIndex,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.white,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Container(
          height: 70,
          padding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeDefault,
            vertical: ThemeDimensions.paddingSizeSmall,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(
                context,
                Icons.chat,
                LocalizationKeysAppWuy.wuyMenuMessages.tr(context),
                WuyAppRouter.routeSearch,
                0,
              ),
              _buildNavItem(
                context,
                Icons.people,
                LocalizationKeysAppWuy.wuyFriendsTitle.tr(context),
                WuyAppRouter.routeHome,
                1,
              ),
              _buildNavItem(
                context,
                Icons.explore,
                LocalizationKeysAppWuy.wuySearchTitle.tr(context),
                WuyAppRouter.routeFindFriends,
                2,
              ),
              _buildNavItem(
                context,
                Icons.person,
                LocalizationKeysAppWuy.wuyMenuProfile.tr(context),
                WuyAppRouter.routeProfile,
                3,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context,
    IconData icon,
    String label,
    String route,
    int index,
  ) {
    final isActive = currentIndex == index;
    final color = isActive ? ThemeColors.primary : ThemeColors.textSecondary;

    return Expanded(
      child: Material(
        color: ThemeColors.transparent,
        child: InkWell(
          onTap: () {
            if (onTap != null) {
              onTap!(index);
            } else {
              context.go(route);
            }
          },
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              vertical: ThemeDimensions.paddingSizeSmall,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  color: color,
                  size: ThemeDimensions.iconSizeMedium,
                ),
                SizedBox(height: ThemeDimensions.spacing4),
                Text(
                  label,
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: color,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
