// Refactored by: Claude Code AI Assistant
// Date: 2024-12-19
// Changes: Updated to use proper theming and follow new Flutter guide standards
// Note to other AIs: This widget now uses ThemeColors and ThemeDimensions

import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class ChatSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final Function(String) onChanged;
  final VoidCallback? onClear;

  const ChatSearchBar({
    super.key,
    required this.controller,
    required this.onChanged,
    this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: 'achat_search_chats'.tr(context),
          hintStyle: TextStyle(color: ThemeColors.grey600),
          prefixIcon: Icon(Icons.search, color: ThemeColors.grey600),
          suffixIcon: controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    controller.clear();
                    onClear?.call();
                  },
                  color: ThemeColors.grey600,
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.spacingSmall),
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: ThemeColors.grey100,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.spacingMedium,
            vertical: ThemeDimensions.spacingSmall,
          ),
        ),
      ),
    );
  }
} 
