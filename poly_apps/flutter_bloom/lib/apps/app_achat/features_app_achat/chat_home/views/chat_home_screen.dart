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

// MODIFIED BY: AI Assistant for chat_home refactoring
// NOTE FOR OTHER AIs: This screen has been refactored to use new architecture
// Please avoid modifying this file during the chat_home refactoring process

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_achat/router_app_achat/router_app_achat.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/common_widgets/bottom_navigation/common_bottom_navigation.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_home/controllers/chat_controller_app_achat.dart';
import 'package:qyflutter/apps/app_achat/model_app_achat/chat_item_model.dart';
import 'package:qyflutter/apps/app_achat/resources_app_achat/assets_images_app_achat.dart';

class ChatHomeScreen extends StatefulWidget {
  const ChatHomeScreen({super.key});

  @override
  State<ChatHomeScreen> createState() => _ChatHomeScreenState();
}

class _ChatHomeScreenState extends State<ChatHomeScreen> {
  final TextEditingController _searchController = TextEditingController();
  late ChatHomeController _controller;
  bool _showAdvertisement = true; // Control advertisement popup visibility

  @override
  void initState() {
    super.initState();
    _controller = ChatHomeController();
    
    // Show advertisement popup after a short delay
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_showAdvertisement) {
        _showAdvertisementPopup();
      }
    });
  }

  void _showAdvertisementPopup() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _buildAdvertisementDialog(),
    );
  }

  Widget _buildAdvertisementDialog() {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
              child: Container(
          width: MediaQuery.of(context).size.width * 0.8,
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.8,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: Colors.white,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
            // Advertisement header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Colors.blue,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(16),
                  topRight: Radius.circular(16),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.campaign,
                    color: Colors.white,
                    size: 24,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'achat_advertisement_title'.tr(context),
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.close,
                      color: Colors.white,
                    ),
                    onPressed: () {
                      setState(() {
                        _showAdvertisement = false;
                      });
                      Navigator.of(context).pop();
                    },
                  ),
                ],
              ),
            ),
            
            // Advertisement content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // Advertisement image
                    Container(
                      width: double.infinity,
                      height: 200,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey[300]!),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.asset(
                          AChatAppAssetsImages.achat_ad_home,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.image,
                                    size: 64,
                                    color: Colors.grey[400],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'achat_advertisement_image_placeholder'.tr(context),
                                    style: TextStyle(
                                      color: Colors.grey[600],
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'achat_advertisement_click_to_close'.tr(context),
                                    style: TextStyle(
                                      color: Colors.grey[500],
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Error: $error',
                                    style: TextStyle(
                                      color: Colors.red[600],
                                      fontSize: 12,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Advertisement text
                    Text(
                      'achat_advertisement_subtitle'.tr(context),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[800],
                      ),
                      textAlign: TextAlign.center,
                    ),
                    
                    const SizedBox(height: 8),
                    
                    Text(
                      'achat_advertisement_description'.tr(context),
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                      textAlign: TextAlign.center,
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Announcements section
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.red[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.pink[200]!),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.pink[100]!,
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Announcements header
                          Row(
                            children: [
                              Icon(
                                Icons.announcement,
                                size: 20,
                                color: Colors.red[600],
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'achat_advertisement_announcements_title'.tr(context),
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.red[600],
                                  shadows: [
                                    Shadow(
                                      color: Colors.pink[200]!,
                                      offset: const Offset(1, 1),
                                      blurRadius: 2,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          
                          const SizedBox(height: 12),
                          
                          // Announcement items
                          _buildAnnouncementItem(
                            context,
                            'achat_advertisement_announcement_1_title'.tr(context),
                            'achat_advertisement_announcement_1_content'.tr(context),
                          ),
                          
                          const SizedBox(height: 8),
                          
                          _buildAnnouncementItem(
                            context,
                            'achat_advertisement_announcement_2_title'.tr(context),
                            'achat_advertisement_announcement_2_content'.tr(context),
                          ),
                          
                          const SizedBox(height: 8),
                          
                          _buildAnnouncementItem(
                            context,
                            'achat_advertisement_announcement_3_title'.tr(context),
                            'achat_advertisement_announcement_3_content'.tr(context),
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Action button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _showAdvertisement = false;
                          });
                          Navigator.of(context).pop();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          'achat_advertisement_button'.tr(context),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnnouncementItem(BuildContext context, String title, String content) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Colors.red[700],
            shadows: [
              Shadow(
                color: Colors.pink[200]!,
                offset: const Offset(1, 1),
                blurRadius: 2,
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          content,
          style: TextStyle(
            fontSize: 13,
            color: Colors.pink[600],
            shadows: [
              Shadow(
                color: Colors.red[200]!,
                offset: const Offset(0.5, 0.5),
                blurRadius: 1,
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showAddMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.person_add),
            title: Text('achat_menu_add_friend'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              context.go(RouterAppAChat.addContacts);
            },
          ),
          ListTile(
            leading: const Icon(Icons.group_add),
            title: Text('achat_menu_create_group'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              // TODO: Navigate to create group
            },
          ),
          ListTile(
            leading: const Icon(Icons.qr_code_scanner),
            title: Text('achat_menu_scan_qr'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              // TODO: Navigate to QR scanner
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _controller,
      child: Consumer<ChatHomeController>(
        builder: (context, controller, child) {
          return Scaffold(
            appBar: CustomAppBar(
              title: 'achat_chat_home_title'.tr(context),
              actions: [
                if (controller.isManageMode) ...[
                  IconButton(
                    icon: const Icon(Icons.select_all),
                    onPressed: controller.selectAllChats,
                  ),
                  IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: controller.clearSelection,
                  ),
                ] else ...[
                  IconButton(
                    icon: const Icon(Icons.search),
                    onPressed: () => _showSearchDialog(context, controller),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: () => _showAddMenu(context),
                  ),
                  IconButton(
                    icon: const Icon(Icons.more_vert),
                    onPressed: () => _showMoreOptions(context, controller),
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
                          onRefresh: controller.refresh,
                          child: ListView.separated(
                            itemCount: controller.filteredChatItems.length,
                            separatorBuilder: (context, index) => const Divider(height: 1),
                            itemBuilder: (context, index) => _buildChatItem(
                              context,
                              controller,
                              controller.filteredChatItems[index],
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

  Widget _buildSearchBar(BuildContext context, ChatHomeController controller) {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      child: TextField(
        controller: _searchController,
        onChanged: controller.searchChats,
        decoration: InputDecoration(
          hintText: 'achat_search_chats'.tr(context),
          prefixIcon: const Icon(Icons.search),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
          ),
          filled: true,
          fillColor: Colors.grey.shade100,
        ),
      ),
    );
  }

  Widget _buildChatItem(
    BuildContext context,
    ChatHomeController controller,
    ChatItemModel chat,
    int index,
  ) {
    final isSelected = controller.selectedChatIds.contains(chat.id);
    final avatarColor = controller.getAvatarColor(index);

    return ListTile(
      leading: Stack(
        children: [
          CircleAvatar(
            backgroundColor: avatarColor,
            backgroundImage: chat.avatarUrl != null ? NetworkImage(chat.avatarUrl!) : null,
            child: chat.avatarUrl == null
                ? Text(
                    chat.avatarText,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          if (chat.isOnline)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: Colors.green,
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
              chat.displayName,
              style: TextStyle(
                fontWeight: chat.hasUnreadMessages ? FontWeight.bold : FontWeight.normal,
                color: chat.isAvailable ? null : Colors.grey[600],
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (!chat.isAvailable) 
            Icon(
              Icons.wifi_off,
              size: 16,
              color: Colors.orange,
            ),
          if (chat.isPinned) const Icon(Icons.push_pin, size: 16, color: Colors.grey),
          if (chat.isGroup) const Icon(Icons.group, size: 16, color: Colors.grey),
          if (chat.isMuted) const Icon(Icons.volume_off, size: 16, color: Colors.grey),
        ],
      ),
      subtitle: Text(
        chat.displayMessage,
        style: TextStyle(
          color: chat.hasUnreadMessages ? Colors.black87 : Colors.grey,
          fontWeight: chat.hasUnreadMessages ? FontWeight.w500 : FontWeight.normal,
        ),
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            chat.timeDisplay,
            style: TextStyle(
              fontSize: 12,
              color: chat.hasUnreadMessages ? Colors.blue : Colors.grey,
            ),
          ),
          if (chat.hasUnreadMessages) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.blue,
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
        } else if (chat.isAvailable) {
          RouterAppAChat.goToChatDetails(context, chat.name);
        } else {
          controller.showNetworkConnectionDialog(context);
        }
      },
      onLongPress: () {
        if (!controller.isManageMode && chat.isAvailable) {
          controller.toggleManageMode();
          controller.toggleChatSelection(chat.id);
        }
      },
    );
  }

  Widget _buildSelectionBottomBar(BuildContext context, ChatHomeController controller) {
    return Container(
      padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
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
              onPressed: controller.hasSelectedChats ? controller.markAllAsRead : null,
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

  void _showSearchDialog(BuildContext context, ChatHomeController controller) {
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
              controller.searchChats('');
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

  void _showMoreOptions(BuildContext context, ChatHomeController controller) {
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
              controller.refresh();
            },
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, ChatHomeController controller) {
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

  @override
  void dispose() {
    _searchController.dispose();
    _controller.dispose();
    super.dispose();
  }
}


