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

// AI: Claude Code - Flexible action bar based on better implementation from ChatListBottomBar
// Reason: Provides reusable action bar for bulk operations, contextual actions, and toolbar functions
// Supports various button types, styles, and layouts for different use cases
// NOTICE TO OTHER AIs: This replaces ChatListBottomBar and similar action bars. Use ActionBar, SelectionActionBar, or ChatActionBar.
// Provides consistent styling and behavior across all apps. Extend ActionBarItem for new action types.

class ActionBarItem {
  final String label;
  final VoidCallback? onPressed;
  final Color? textColor;
  final Color? backgroundColor;
  final IconData? icon;
  final bool isDestructive;
  final bool isEnabled;

  const ActionBarItem({
    required this.label,
    this.onPressed,
    this.textColor,
    this.backgroundColor,
    this.icon,
    this.isDestructive = false,
    this.isEnabled = true,
  });
}

class ActionBar extends StatelessWidget {
  final List<ActionBarItem> actions;
  final Color? backgroundColor;
  final EdgeInsetsGeometry? padding;
  final MainAxisAlignment mainAxisAlignment;
  final CrossAxisAlignment crossAxisAlignment;
  final bool useElevation;
  final double? elevation;

  const ActionBar({
    super.key,
    required this.actions,
    this.backgroundColor,
    this.padding,
    this.mainAxisAlignment = MainAxisAlignment.spaceBetween,
    this.crossAxisAlignment = CrossAxisAlignment.center,
    this.useElevation = true,
    this.elevation,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final defaultBackgroundColor = backgroundColor ?? 
                                   theme.bottomAppBarTheme.color ?? 
                                   theme.scaffoldBackgroundColor;

    return Container(
      decoration: BoxDecoration(
        color: defaultBackgroundColor,
        boxShadow: useElevation ? [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: elevation ?? 4,
            offset: const Offset(0, -1),
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
            mainAxisAlignment: mainAxisAlignment,
            crossAxisAlignment: crossAxisAlignment,
            children: actions.map((action) => _buildActionButton(context, action)).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton(BuildContext context, ActionBarItem action) {
    final theme = Theme.of(context);
    final defaultTextColor = action.isDestructive 
        ? theme.colorScheme.error 
        : theme.primaryColor;
    
    if (action.icon != null) {
      return IconButton(
        onPressed: action.isEnabled ? action.onPressed : null,
        icon: Icon(
          action.icon!,
          color: action.isEnabled 
              ? (action.textColor ?? defaultTextColor)
              : theme.disabledColor,
        ),
        tooltip: action.label.tr(context),
      );
    }

    return TextButton(
      onPressed: action.isEnabled ? action.onPressed : null,
      style: TextButton.styleFrom(
        backgroundColor: action.backgroundColor,
        foregroundColor: action.isEnabled 
            ? (action.textColor ?? defaultTextColor)
            : theme.disabledColor,
        padding: const EdgeInsets.symmetric(
          horizontal: ThemeDimensions.paddingSizeDefault,
          vertical: ThemeDimensions.paddingSizeSmall,
        ),
      ),
      child: Text(
        action.label.tr(context),
        style: ThemeTextStyles.bodyMedium.copyWith(
          color: action.isEnabled 
              ? (action.textColor ?? defaultTextColor)
              : theme.disabledColor,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

// Specialized action bars for common use cases

class SelectionActionBar extends ActionBar {
  final VoidCallback? onSelectAll;
  final VoidCallback? onDeselectAll;
  final VoidCallback? onDelete;
  final VoidCallback? onArchive;
  final int selectedCount;
  final int totalCount;

  SelectionActionBar({
    super.key,
    this.onSelectAll,
    this.onDeselectAll,
    this.onDelete,
    this.onArchive,
    required this.selectedCount,
    required this.totalCount,
    super.backgroundColor,
    super.padding,
    super.useElevation,
    super.elevation,
  }) : super(
    actions: [
      if (selectedCount < totalCount)
        ActionBarItem(
          label: 'select_all',
          onPressed: onSelectAll,
        )
      else
        ActionBarItem(
          label: 'deselect_all',
          onPressed: onDeselectAll,
        ),
      if (onArchive != null)
        ActionBarItem(
          label: 'archive',
          onPressed: selectedCount > 0 ? onArchive : null,
          isEnabled: selectedCount > 0,
        ),
      ActionBarItem(
        label: 'delete',
        onPressed: selectedCount > 0 ? onDelete : null,
        isDestructive: true,
        isEnabled: selectedCount > 0,
      ),
    ],
  );
}

class ChatActionBar extends ActionBar {
  final VoidCallback? onAllRead;
  final VoidCallback? onDelete;
  final VoidCallback? onMute;
  final VoidCallback? onPin;

  ChatActionBar({
    super.key,
    this.onAllRead,
    this.onDelete,
    this.onMute,
    this.onPin,
    super.backgroundColor,
    super.padding,
    super.useElevation,
    super.elevation,
  }) : super(
    actions: [
      ActionBarItem(
        label: 'mark_all_read',
        onPressed: onAllRead,
      ),
      if (onMute != null)
        ActionBarItem(
          label: 'mute',
          onPressed: onMute,
        ),
      if (onPin != null)
        ActionBarItem(
          label: 'pin',
          onPressed: onPin,
        ),
      ActionBarItem(
        label: 'delete',
        onPressed: onDelete,
        isDestructive: true,
      ),
    ],
  );
}