import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class AChatBottomNavigation extends StatelessWidget {
  final int currentIndex;
  final Function(int)? onTap;

  const AChatBottomNavigation({
    super.key,
    required this.currentIndex,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).bottomNavigationBarTheme.backgroundColor ??
               Theme.of(context).scaffoldBackgroundColor,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeDefault,
            vertical: ThemeDimensions.paddingSizeSmall,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(
                context: context,
                icon: Icons.chat_bubble_outline,
                activeIcon: Icons.chat_bubble,
                label: 'achat_nav_chats'.tr(context),
                index: 0,
                route: '/chat-home',
              ),
              _buildNavItem(
                context: context,
                icon: Icons.contacts_outlined,
                activeIcon: Icons.contacts,
                label: 'achat_nav_contacts'.tr(context),
                index: 1,
                route: '/contacts',
              ),
              _buildNavItem(
                context: context,
                icon: Icons.explore_outlined,
                activeIcon: Icons.explore,
                label: 'achat_nav_discover'.tr(context),
                index: 2,
                route: '/discover',
              ),
              _buildNavItem(
                context: context,
                icon: Icons.person_outline,
                activeIcon: Icons.person,
                label: 'achat_nav_profile'.tr(context),
                index: 3,
                route: '/profile',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required BuildContext context,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    required int index,
    required String route,
  }) {
    final isActive = currentIndex == index;
    final theme = Theme.of(context);

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
                  isActive ? activeIcon : icon,
                  color: isActive
                    ? theme.primaryColor
                    : theme.unselectedWidgetColor,
                  size: ThemeDimensions.iconSizeMedium,
                ),
                SizedBox(height: ThemeDimensions.spacing4),
                Text(
                  label,
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: isActive
                      ? theme.primaryColor
                      : theme.unselectedWidgetColor,
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
