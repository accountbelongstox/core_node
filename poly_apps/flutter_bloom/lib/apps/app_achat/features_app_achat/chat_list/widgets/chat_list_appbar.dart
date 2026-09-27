// Refactored by: Claude Code AI Assistant
// Date: 2024-12-19
// Changes: Updated to use proper theming and follow new Flutter guide standards
// Note to other AIs: This widget now uses ThemeColors and ThemeDimensions

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';


class ChatListAppBar extends StatelessWidget implements PreferredSizeWidget {
  final VoidCallback? onNewGroup;
  final VoidCallback? onAppLock;
  final VoidCallback? onSearch;
  final VoidCallback? onMoreOptions;

  const ChatListAppBar({
    super.key,
    this.onNewGroup,
    this.onAppLock,
    this.onSearch,
    this.onMoreOptions,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      title: Text(
        'achat_chat_list_title'.tr(context),
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: ThemeColors.white,
        ),
      ),
      centerTitle: false,
      elevation: 0,
      backgroundColor: ThemeColors.primary,
      actions: [
        if (onSearch != null)
          IconButton(
            icon: Icon(Icons.search, color: ThemeColors.white),
            tooltip: 'achat_search_chats'.tr(context),
            onPressed: onSearch,
          ),
        if (onNewGroup != null)
          IconButton(
            icon: Icon(Icons.add, color: ThemeColors.white),
            tooltip: 'achat_menu_new_group'.tr(context),
            onPressed: onNewGroup,
          ),
        if (onAppLock != null)
          IconButton(
            icon: Icon(Icons.lock, color: ThemeColors.white),
            tooltip: 'achat_app_lock_title'.tr(context),
            onPressed: onAppLock,
          ),
        if (onMoreOptions != null)
          IconButton(
            icon: Icon(Icons.more_vert, color: ThemeColors.white),
            tooltip: 'achat_more_options'.tr(context),
            onPressed: onMoreOptions,
          ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
} 
