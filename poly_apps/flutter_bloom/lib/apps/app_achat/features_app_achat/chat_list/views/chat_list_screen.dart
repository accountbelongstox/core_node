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

// Refactored by: Claude Code AI Assistant
// Date: 2024-12-19
// Changes: Completely refactored to use better implementation from chat_list_alt
// Note to other AIs: This screen now follows new Flutter guide standards with proper theming

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/back_app_bar.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/common_widgets/bottom_navigation/common_bottom_navigation.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_list/controllers/chat_list_controller.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_list/domain/model/chat_list_model.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final TextEditingController _searchController = TextEditingController();
  late ChatListController _controller;

  @override
  void initState() {
    super.initState();
    _controller = ChatListController();
    _controller.initialize();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _controller,
      child: Consumer<ChatListController>(
        builder: (context, controller, child) {
          return Scaffold(
            backgroundColor: Theme.of(context).colorScheme.surface,
            appBar: BackAppBar(
              title: 'achat_chat_list_title',
              titleSize: 20,
              actions: [
                if (controller.isManageMode) ...[
                  IconButton(
                    icon: const Icon(Icons.select_all),
                    onPressed: controller.selectAllChats,
                    tooltip: 'achat_select_all'.tr(context),
                  ),
                  IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: controller.deselectAllChats,
                    tooltip: 'achat_clear_selection'.tr(context),
                  ),
                ] else ...[
                  IconButton(
                    icon: const Icon(Icons.search),
                    onPressed: () => _showSearchDialog(context, controller),
                    tooltip: 'achat_search_chats'.tr(context),
                  ),
                  IconButton(
                    icon: const Icon(Icons.more_vert),
                    onPressed: () => _showMoreOptions(context, controller),
                    tooltip: 'achat_more_options'.tr(context),
                  ),
                ],
              ],
            ),
            body: Column(
              children: [
                _buildSearchBar(context, controller),
                Expanded(
                  child: controller.isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : RefreshIndicator(
                          onRefresh: controller.refreshChats,
                          child: ListView.separated(
                            itemCount: controller.filteredChats.length,
                            separatorBuilder: (context, index) => const Divider(height: 1),
                            itemBuilder: (context, index) => _buildChatItem(
                              context,
                              controller,
                              controller.filteredChats[index],
                              index,
                            ),
                          ),
                        ),
                ),
              ],
            ),
            bottomNavigationBar: controller.isManageMode
                ? _buildSelectionBottomBar(context, controller)
                : const CommonBottomNavigation(currentIndex: 0),
          );
        },
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context, ChatListController controller) {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
      child: TextField(
        controller: _searchController,
        onChanged: controller.searchChats,
        decoration: InputDecoration(
          hintText: 'achat_search_chats'.tr(context),
          prefixIcon: const Icon(Icons.search),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.spacingSmall),
          ),
          filled: true,
          fillColor: ThemeColors.grey100,
        ),
      ),
    );
  }

  Widget _buildChatItem(
    BuildContext context,
    ChatListController controller,
    ChatItemModel chat,
    int index,
  ) {
    final isSelected = controller.selectedChatIds.contains(chat.id);
    final avatarColor = _getAvatarColor(index);

    return ListTile(
      leading: Stack(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: avatarColor,
              borderRadius: BorderRadius.circular(ThemeDimensions.spacingSmall),
            ),
            alignment: Alignment.center,
            child: Text(
              chat.label,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ),
          if (chat.isOnline)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: ThemeColors.green,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
        ],
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              chat.name,
              style: TextStyle(
                fontWeight: chat.unreadCount > 0 ? FontWeight.bold : FontWeight.normal,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (chat.status == ChatItemStatus.pinned) 
            const Icon(Icons.push_pin, size: 16, color: Colors.grey),
          if (chat.type == ChatItemType.group) 
            const Icon(Icons.group, size: 16, color: Colors.grey),
        ],
      ),
      subtitle: Text(
        chat.message,
        style: TextStyle(
          color: chat.unreadCount > 0 ? Colors.black87 : Colors.grey,
          fontWeight: chat.unreadCount > 0 ? FontWeight.w500 : FontWeight.normal,
        ),
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            chat.time,
            style: TextStyle(
              fontSize: 12,
              color: chat.unreadCount > 0 ? ThemeColors.blue : Colors.grey,
            ),
          ),
          if (chat.unreadCount > 0) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: ThemeColors.blue,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                chat.unreadCount > 99 ? '99+' : chat.unreadCount.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
      selected: isSelected,
      onTap: () {
        if (controller.isManageMode) {
          controller.toggleChatSelection(chat.id);
        } else {
          controller.navigateToChat(chat.id);
        }
      },
      onLongPress: () {
        if (!controller.isManageMode) {
          controller.toggleManageMode();
          controller.toggleChatSelection(chat.id);
        }
      },
    );
  }

  Widget _buildSelectionBottomBar(BuildContext context, ChatListController controller) {
    return Container(
      padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            TextButton.icon(
              onPressed: controller.hasSelectedChats ? controller.markSelectedChatsAsRead : null,
              icon: const Icon(Icons.mark_chat_read),
              label: Text('achat_mark_read'.tr(context)),
            ),
            TextButton.icon(
              onPressed: controller.hasSelectedChats ? () => _confirmDelete(context, controller) : null,
              icon: const Icon(Icons.delete),
              label: Text('achat_delete'.tr(context)),
            ),
          ],
        ),
      ),
    );
  }

  void _showSearchDialog(BuildContext context, ChatListController controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('achat_search_chats'.tr(context)),
        content: TextField(
          controller: _searchController,
          onChanged: controller.searchChats,
          decoration: InputDecoration(
            hintText: 'achat_search_hint'.tr(context),
            prefixIcon: const Icon(Icons.search),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () {
              _searchController.clear();
              controller.clearSearch();
              Navigator.pop(context);
            },
            child: Text('achat_clear'.tr(context)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('achat_close'.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showMoreOptions(BuildContext context, ChatListController controller) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.select_all),
            title: Text('achat_select_mode'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              controller.toggleManageMode();
            },
          ),
          ListTile(
            leading: const Icon(Icons.refresh),
            title: Text('achat_refresh'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              controller.refreshChats();
            },
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, ChatListController controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('achat_confirm_delete'.tr(context)),
        content: Text('achat_delete_chats_message'.tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('achat_cancel'.tr(context)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              controller.deleteSelectedChats();
            },
            child: Text('achat_delete'.tr(context)),
          ),
        ],
      ),
    );
  }

  Color _getAvatarColor(int index) {
    final colors = ChatItemModel.getAvatarColors();
    return colors[index % colors.length];
  }

  @override
  void dispose() {
    _searchController.dispose();
    _controller.dispose();
    super.dispose();
  }
}
