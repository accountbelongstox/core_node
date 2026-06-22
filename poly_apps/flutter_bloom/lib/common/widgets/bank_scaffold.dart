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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'bank_bottom_navigation.dart';

/// Bank Scaffold
/// 
/// A specialized scaffold for banking applications that includes:
/// - Standard app bar with banking-specific styling
/// - Bottom navigation bar
/// - Proper theming and responsive design
/// - Support for different banking app layouts
/// 
/// USAGE:
/// - Use as the main scaffold for all banking app screens
/// - Provides consistent navigation and layout across the app
/// - Supports customization while maintaining banking app standards
class BankScaffold extends StatelessWidget {
  final Widget body;
  final PreferredSizeWidget? appBar;
  final int currentBottomNavIndex;
  final Function(int)? onBottomNavTap;
  final List<BankNavigationItem>? customBottomNavItems;
  final bool showBottomNavigation;
  final Color? backgroundColor;
  final bool extendBodyBehindAppBar;
  final bool extendBody;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final Widget? drawer;
  final Widget? endDrawer;
  final Widget? bottomSheet;
  final bool resizeToAvoidBottomInset;
  final bool primary;

  const BankScaffold({
    super.key,
    required this.body,
    this.appBar,
    required this.currentBottomNavIndex,
    this.onBottomNavTap,
    this.customBottomNavItems,
    this.showBottomNavigation = true,
    this.backgroundColor,
    this.extendBodyBehindAppBar = false,
    this.extendBody = false,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.drawer,
    this.endDrawer,
    this.bottomSheet,
    this.resizeToAvoidBottomInset = true,
    this.primary = true,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: backgroundColor ?? 
                      (isDark ? ThemeColors.grey900 : Colors.white),
      appBar: appBar,
      extendBodyBehindAppBar: extendBodyBehindAppBar,
      extendBody: extendBody,
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: floatingActionButtonLocation,
      drawer: drawer,
      endDrawer: endDrawer,
      bottomSheet: bottomSheet,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      primary: primary,
      body: body,
      bottomNavigationBar: showBottomNavigation
          ? (customBottomNavItems != null
              ? CustomBankBottomNavigation(
                  currentIndex: currentBottomNavIndex,
                  items: customBottomNavItems!,
                  onTap: onBottomNavTap,
                )
              : BankBottomNavigation(
                  currentIndex: currentBottomNavIndex,
                  onTap: onBottomNavTap,
                ))
          : null,
    );
  }
}

/// Bank App Bar
/// 
/// A specialized app bar for banking applications with:
/// - Banking-specific styling and colors
/// - Support for search functionality
/// - Customer service and message buttons
/// - Consistent with banking app design patterns
class BankAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String? title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool automaticallyImplyLeading;
  final PreferredSizeWidget? bottom;
  final double? elevation;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final bool centerTitle;
  final double? titleSpacing;
  final double? toolbarHeight;
  final double? leadingWidth;
  final bool primary;
  final Widget? flexibleSpace;
  final double? scrolledUnderElevation;
  final Color? shadowColor;
  final Color? surfaceTintColor;
  final ShapeBorder? shape;
  final IconThemeData? iconTheme;
  final IconThemeData? actionsIconTheme;
  final TextTheme? textTheme;
  final bool forceMaterialTransparency;

  const BankAppBar({
    super.key,
    this.title,
    this.actions,
    this.leading,
    this.automaticallyImplyLeading = true,
    this.bottom,
    this.elevation,
    this.backgroundColor,
    this.foregroundColor,
    this.centerTitle = true,
    this.titleSpacing,
    this.toolbarHeight,
    this.leadingWidth,
    this.primary = true,
    this.flexibleSpace,
    this.scrolledUnderElevation,
    this.shadowColor,
    this.surfaceTintColor,
    this.shape,
    this.iconTheme,
    this.actionsIconTheme,
    this.textTheme,
    this.forceMaterialTransparency = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return AppBar(
      title: title != null ? Text(title!) : null,
      actions: actions,
      leading: leading,
      automaticallyImplyLeading: automaticallyImplyLeading,
      bottom: bottom,
      elevation: elevation ?? 0,
      backgroundColor: backgroundColor ?? 
                      (isDark ? ThemeColors.grey900 : Colors.white),
      foregroundColor: foregroundColor ?? 
                      (isDark ? Colors.white : ThemeColors.black87),
      centerTitle: centerTitle,
      titleSpacing: titleSpacing,
      toolbarHeight: toolbarHeight ?? kToolbarHeight,
      leadingWidth: leadingWidth,
      primary: primary,
      flexibleSpace: flexibleSpace,
      scrolledUnderElevation: scrolledUnderElevation,
      shadowColor: shadowColor,
      surfaceTintColor: surfaceTintColor,
      shape: shape,
      iconTheme: iconTheme,
      actionsIconTheme: actionsIconTheme,
      forceMaterialTransparency: forceMaterialTransparency,
    );
  }

  @override
  Size get preferredSize => Size.fromHeight(
    (toolbarHeight ?? kToolbarHeight) + 
    (bottom?.preferredSize.height ?? 0)
  );
}

/// Bank Search App Bar
/// 
/// A specialized app bar with search functionality for banking applications
class BankSearchAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String? hintText;
  final Function(String)? onSearchChanged;
  final VoidCallback? onSearchTap;
  final VoidCallback? onCustomerServiceTap;
  final VoidCallback? onMessageTap;
  final Widget? leading;
  final List<Widget>? additionalActions;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double? elevation;

  const BankSearchAppBar({
    super.key,
    this.hintText,
    this.onSearchChanged,
    this.onSearchTap,
    this.onCustomerServiceTap,
    this.onMessageTap,
    this.leading,
    this.additionalActions,
    this.backgroundColor,
    this.foregroundColor,
    this.elevation,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return AppBar(
      elevation: 0,
      backgroundColor: Colors.transparent, // Transparent background
      foregroundColor: Colors.white, // White text/icons
      leading: leading,
      title: _buildSearchBar(context, isDark),
      actions: [
        if (onCustomerServiceTap != null)
          IconButton(
            onPressed: onCustomerServiceTap,
            icon: const Icon(Icons.headset_mic_outlined),
            color: Colors.white,
            tooltip: 'Customer Service',
          ),
        if (onMessageTap != null)
          IconButton(
            onPressed: onMessageTap,
            icon: const Icon(Icons.message_outlined),
            color: Colors.white,
            tooltip: 'Messages',
          ),
        if (additionalActions != null) ...additionalActions!,
      ],
    );
  }

  Widget _buildSearchBar(BuildContext context, bool isDark) {
    return Container(
      height: 36,
      margin: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15), // Very transparent white
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: Colors.white.withOpacity(0.2),
          width: 0.5,
        ),
      ),
      child: TextField(
        onChanged: onSearchChanged,
        onTap: onSearchTap,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
        ),
        decoration: InputDecoration(
          hintText: hintText ?? 'Search...',
          hintStyle: const TextStyle(
            color: Colors.white70,
            fontSize: 14,
          ),
          prefixIcon: const Icon(
            Icons.search,
            color: Colors.white70,
            size: 18,
          ),
          suffixIcon: IconButton(
            onPressed: () {
              // Voice search functionality
            },
            icon: const Icon(
              Icons.mic,
              color: Colors.white70,
              size: 18,
            ),
            tooltip: 'Voice Search',
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 6,
          ),
        ),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
