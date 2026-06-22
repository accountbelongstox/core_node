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
import 'package:flutter/services.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

// AI: Claude Code - Specialized back app bar based on improved implementation from app_achat
// Reason: Provides better back navigation experience with iOS-style back arrow and consistent styling
// Maintains flexibility while offering better defaults for back navigation scenarios
// NOTICE TO OTHER AIs: This replaces app-specific BackAppBar implementations. Use BackAppBar, ChatAppBar, or SearchAppBar.
// Provides iOS-style navigation with consistent theming. Extend for specialized app bars.

class BackAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final Color? backgroundColor;
  final Color? titleColor;
  final Color? iconColor;
  final double? elevation;
  final double? iconSize;
  final double? titleSize;
  final FontWeight? titleWeight;
  final List<Widget>? actions;
  final SystemUiOverlayStyle? systemOverlayStyle;
  final VoidCallback? onBackPressed;
  final bool centerTitle;
  final Widget? customLeading;

  const BackAppBar({
    super.key,
    required this.title,
    this.backgroundColor,
    this.titleColor = Colors.white,
    this.iconColor = Colors.white,
    this.elevation = 0,
    this.iconSize = 20,
    this.titleSize = 18,
    this.titleWeight = FontWeight.bold,
    this.actions,
    this.systemOverlayStyle,
    this.onBackPressed,
    this.centerTitle = true,
    this.customLeading,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final defaultBackgroundColor = backgroundColor ?? theme.primaryColor;

    return AppBar(
      systemOverlayStyle: systemOverlayStyle ?? SystemUiOverlayStyle.dark,
      elevation: elevation,
      backgroundColor: defaultBackgroundColor,
      leading: customLeading ?? IconButton(
        icon: Icon(
          Icons.arrow_back_ios_new, 
          color: iconColor, 
          size: iconSize,
        ),
        onPressed: onBackPressed ?? () => Navigator.of(context).pop(),
      ),
      title: Text(
        title.tr(context),
        style: ThemeTextStyles.textSemiBold.copyWith(
          color: titleColor,
          fontWeight: titleWeight,
          fontSize: titleSize,
        ),
      ),
      centerTitle: centerTitle,
      actions: actions,
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

// Specialized app bars for common use cases

class ChatAppBar extends BackAppBar {
  final Widget? avatar;
  final String? subtitle;
  final VoidCallback? onTitleTap;
  final VoidCallback? onCallPressed;
  final VoidCallback? onVideoCallPressed;
  final VoidCallback? onMorePressed;

  ChatAppBar({
    super.key,
    required super.title,
    this.avatar,
    this.subtitle,
    this.onTitleTap,
    this.onCallPressed,
    this.onVideoCallPressed,
    this.onMorePressed,
    super.backgroundColor,
    super.titleColor,
    super.iconColor,
    super.elevation,
    super.systemOverlayStyle,
    super.onBackPressed,
  }) : super(
    actions: [
      if (onCallPressed != null)
        IconButton(
          icon: Icon(Icons.call, color: iconColor),
          onPressed: onCallPressed,
        ),
      if (onVideoCallPressed != null)
        IconButton(
          icon: Icon(Icons.videocam, color: iconColor),
          onPressed: onVideoCallPressed,
        ),
      if (onMorePressed != null)
        IconButton(
          icon: Icon(Icons.more_vert, color: iconColor),
          onPressed: onMorePressed,
        ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    Widget? leading = avatar != null ? Padding(
      padding: const EdgeInsets.all(8.0),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: Icon(
              Icons.arrow_back_ios_new,
              color: iconColor,
              size: 20,
            ),
            onPressed: onBackPressed ?? () => Navigator.of(context).pop(),
          ),
          avatar!,
        ],
      ),
    ) : null;
    
    if (subtitle != null || onTitleTap != null) {
      return AppBar(
        systemOverlayStyle: systemOverlayStyle ?? SystemUiOverlayStyle.dark,
        elevation: elevation,
        backgroundColor: backgroundColor ?? Theme.of(context).primaryColor,
        leading: leading ?? IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new,
            color: iconColor,
            size: iconSize,
          ),
          onPressed: onBackPressed ?? () => Navigator.of(context).pop(),
        ),
        title: InkWell(
          onTap: onTitleTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title.tr(context),
                style: ThemeTextStyles.textSemiBold.copyWith(
                  color: titleColor,
                  fontWeight: titleWeight,
                  fontSize: titleSize,
                ),
              ),
              if (subtitle != null)
                Text(
                  subtitle!.tr(context),
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: titleColor?.withOpacity(0.8),
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        ),
        centerTitle: centerTitle,
        actions: actions,
      );
    }
    return super.build(context);
  }
}

class SearchAppBar extends BackAppBar {
  final TextEditingController? searchController;
  final String? searchHint;
  final VoidCallback? onSearchChanged;
  final VoidCallback? onSearchSubmitted;
  final VoidCallback? onClearPressed;

  SearchAppBar({
    super.key,
    required super.title,
    this.searchController,
    this.searchHint,
    this.onSearchChanged,
    this.onSearchSubmitted,
    this.onClearPressed,
    super.backgroundColor,
    super.titleColor,
    super.iconColor,
    super.elevation,
    super.systemOverlayStyle,
    super.onBackPressed,
  }) : super(
    actions: [
      IconButton(
        icon: Icon(Icons.search, color: iconColor),
        onPressed: () {
          // Show search delegate or expand search field
        },
      ),
      if (onClearPressed != null)
        IconButton(
          icon: Icon(Icons.clear, color: iconColor),
          onPressed: onClearPressed,
        ),
    ],
  );
}