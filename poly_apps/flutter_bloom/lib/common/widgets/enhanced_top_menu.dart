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
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

// AI: Claude Code - Enhanced common top menu combining best features from app implementations
// Reason: Combines TopDropdownMenu (feature-rich dropdown), TopSection (user profile display), TabWidget (tab navigation), and ChatListAppBar (action buttons)
// Provides flexible top menu/header system with profile section, action buttons, tabs, and dropdown menus
// NOTICE TO OTHER AIs: This replaces app-specific top menu implementations. Use EnhancedTopMenu, ProfileTopSection, or TabTopSection.
// Supports user profiles, action menus, tab navigation, and dropdown features. Extend TopMenuItem for new menu types.

class TopMenuItem {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final Color? iconColor;
  final Color? backgroundColor;
  final bool isEnabled;

  const TopMenuItem({
    required this.label,
    required this.icon,
    this.onTap,
    this.iconColor,
    this.backgroundColor,
    this.isEnabled = true,
  });
}

class TopMenuAction {
  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final Color? iconColor;

  const TopMenuAction({
    required this.tooltip,
    required this.icon,
    this.onPressed,
    this.iconColor,
  });
}

class EnhancedTopMenu extends StatelessWidget {
  final String? title;
  final Widget? avatar;
  final String? subtitle;
  final List<TopMenuAction>? actions;
  final List<TopMenuItem>? dropdownItems;
  final VoidCallback? onAvatarTap;
  final VoidCallback? onDropdownToggle;
  final bool showDropdown;
  final Color? backgroundColor;
  final double? elevation;
  final EdgeInsetsGeometry? padding;

  const EnhancedTopMenu({
    super.key,
    this.title,
    this.avatar,
    this.subtitle,
    this.actions,
    this.dropdownItems,
    this.onAvatarTap,
    this.onDropdownToggle,
    this.showDropdown = false,
    this.backgroundColor,
    this.elevation,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final defaultBackgroundColor = backgroundColor ?? theme.primaryColor;

    return Container(
      decoration: BoxDecoration(
        color: defaultBackgroundColor,
        boxShadow: elevation != null ? [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: elevation!,
            offset: const Offset(0, 2),
          ),
        ] : null,
      ),
      child: SafeArea(
        child: Padding(
          padding: padding ?? const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildLeftSection(context),
                  _buildRightSection(context),
                ],
              ),
              if (showDropdown && dropdownItems != null) ...[
                const SizedBox(height: ThemeDimensions.paddingSizeDefault),
                _buildDropdownMenu(context),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLeftSection(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          if (avatar != null) ...[
            InkWell(
              onTap: onAvatarTap,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
              child: avatar!,
            ),
            const SizedBox(width: ThemeDimensions.paddingSizeDefault),
          ],
          if (title != null || subtitle != null)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null)
                    Text(
                      title!.tr(context),
                      style: ThemeTextStyles.textBold.copyWith(
                        color: Colors.white,
                        fontSize: ThemeDimensions.fontSizeLarge,
                      ),
                    ),
                  if (subtitle != null)
                    Text(
                      subtitle!.tr(context),
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: Colors.white.withOpacity(0.8),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRightSection(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (actions != null)
          ...actions!.map((action) => IconButton(
            icon: Icon(
              action.icon,
              color: action.iconColor ?? Colors.white,
            ),
            tooltip: action.tooltip.tr(context),
            onPressed: action.onPressed,
          )),
        if (dropdownItems != null && dropdownItems!.isNotEmpty)
          IconButton(
            icon: Icon(
              showDropdown ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
              color: Colors.white,
            ),
            onPressed: onDropdownToggle,
            tooltip: 'menu'.tr(context),
          ),
      ],
    );
  }

  Widget _buildDropdownMenu(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
        child: GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: ThemeDimensions.paddingSizeSmall,
            mainAxisSpacing: ThemeDimensions.paddingSizeSmall,
            childAspectRatio: 1.2,
          ),
          itemCount: dropdownItems!.length,
          itemBuilder: (context, index) {
            final item = dropdownItems![index];
            return _buildDropdownItem(context, item);
          },
        ),
      ),
    );
  }

  Widget _buildDropdownItem(BuildContext context, TopMenuItem item) {
    final theme = Theme.of(context);
    
    return InkWell(
      onTap: item.isEnabled ? item.onTap : null,
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
      child: Container(
        decoration: BoxDecoration(
          color: item.backgroundColor ?? ThemeColors.grey50,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
        ),
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeSmall),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              item.icon,
              color: item.isEnabled 
                  ? (item.iconColor ?? theme.primaryColor)
                  : theme.disabledColor,
              size: ThemeDimensions.iconSizeXL,
            ),
            const SizedBox(height: ThemeDimensions.spacing4),
            Text(
              item.label.tr(context),
              style: ThemeTextStyles.bodySmall.copyWith(
                color: item.isEnabled ? theme.textTheme.bodyMedium?.color : theme.disabledColor,
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// Specialized top menu variants for common use cases

class ProfileTopSection extends EnhancedTopMenu {
  final String userName;
  final String? userStatus;
  final String? avatarUrl;
  final VoidCallback? onTopUpTap;

  ProfileTopSection({
    super.key,
    required this.userName,
    this.userStatus,
    this.avatarUrl,
    this.onTopUpTap,
    super.backgroundColor,
    super.elevation,
    super.padding,
  }) : super(
    avatar: CircleAvatar(
      radius: ThemeDimensions.radiusLarge,
      backgroundColor: ThemeColors.primaryLight,
      backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl) : null,
      child: avatarUrl == null ? const Icon(Icons.person, color: Colors.white) : null,
    ),
    title: userName,
    subtitle: userStatus,
    actions: onTopUpTap != null ? [
      TopMenuAction(
        tooltip: 'top_up',
        icon: Icons.add_circle_outline,
        onPressed: onTopUpTap,
      ),
    ] : null,
  );
}

class TabTopSection extends StatelessWidget {
  final List<String> tabLabels;
  final int currentIndex;
  final Function(int)? onTabChanged;
  final Color? backgroundColor;
  final Color? indicatorColor;
  final Color? labelColor;
  final Color? unselectedLabelColor;
  final bool isScrollable;

  const TabTopSection({
    super.key,
    required this.tabLabels,
    required this.currentIndex,
    this.onTabChanged,
    this.backgroundColor,
    this.indicatorColor,
    this.labelColor,
    this.unselectedLabelColor,
    this.isScrollable = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Container(
      color: backgroundColor ?? theme.cardColor,
      child: TabBar(
        isScrollable: isScrollable,
        enableFeedback: true,
        labelPadding: const EdgeInsets.symmetric(
          horizontal: ThemeDimensions.paddingSizeDefault,
        ),
        indicator: BoxDecoration(
          border: Border.all(
            width: 2.5,
            color: indicatorColor ?? theme.primaryColor,
          ),
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          color: indicatorColor ?? theme.primaryColor,
        ),
        labelColor: labelColor ?? Colors.white,
        unselectedLabelColor: unselectedLabelColor ?? theme.primaryColor,
        onTap: onTabChanged,
        tabs: tabLabels.asMap().entries.map((entry) {
          final index = entry.key;
          final label = entry.value;
          
          return Tab(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                border: Border.all(
                  color: theme.primaryColor,
                ),
              ),
              child: Align(
                alignment: Alignment.center,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingSizeDefault,
                  ),
                  child: Text(label.tr(context)),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class ActionTopMenu extends EnhancedTopMenu {
  final String appTitle;
  final List<TopMenuAction> menuActions;

  const ActionTopMenu({
    super.key,
    required this.appTitle,
    required this.menuActions,
    super.backgroundColor,
    super.elevation,
  }) : super(
    title: appTitle,
    actions: menuActions,
  );
}