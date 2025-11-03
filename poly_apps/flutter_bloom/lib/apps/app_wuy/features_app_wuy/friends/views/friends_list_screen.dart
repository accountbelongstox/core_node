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
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';
import '../../../widgets_app_wuy/wuy_modern_input_field.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../providers_app_wuy/wu_user_provider.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_common_background.dart';
import '../../../services_app_wuy/wuy_unified_service.dart';

/// Friends List Screen for Wuy App
///
/// This screen displays a list of friends and provides search functionality.
/// Users can view friend information and add new friends.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyFriendsTitle.tr(context)
class WuyFriendsListScreen extends StatefulWidget {
  const WuyFriendsListScreen({super.key});

  @override
  State<WuyFriendsListScreen> createState() => _WuyFriendsListScreenState();
}

class _WuyFriendsListScreenState extends State<WuyFriendsListScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<FriendModelAppWuy> _allFriends = [];
  List<FriendModelAppWuy> _filteredFriends = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadFriends() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final dataManager = WuyUnifiedService();
      final response = await dataManager.getFriends();

      if (mounted) {
        setState(() {
          _allFriends = response.data ?? [];
          _filteredFriends = response.data ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading friends: $e');
      if (mounted) {
        setState(() {
          _allFriends = [];
          _filteredFriends = [];
          _isLoading = false;
        });
      }
    }
  }

  void _filterFriends(String query) {
    setState(() {
      if (query.isEmpty) {
        _filteredFriends = _allFriends;
      } else {
        _filteredFriends = _allFriends.where((friend) {
          return friend.displayName
                  .toLowerCase()
                  .contains(query.toLowerCase()) ||
              (friend.username?.toLowerCase().contains(query.toLowerCase()) ??
                  false) ||
              (friend.phoneNumber?.contains(query) ?? false);
        }).toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<WuUserProvider>(
      builder: (context, userProvider, child) {
        return WuyCommonBackground(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(
              title: Text(
                LocalizationKeysAppWuy.wuyFriendsTitle.tr(context),
                style: WuyAppThemeConfig.wuyAppBarTitle.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 22,
                  letterSpacing: -0.5,
                ),
              ),
              backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
              elevation: 0,
              centerTitle: true,
              flexibleSpace: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      WuyAppThemeConfig.wuyPrimaryColor,
                      WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.9),
                    ],
                  ),
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.search, color: Colors.white),
                  onPressed: () {
                    context.go(WuyAppRouter.routeSearch);
                  },
                ),
              ],
            ),
            body: Column(
              children: [
                _buildSearchBar(),
                Expanded(
                  child: _isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : _buildFriendsList(),
                ),
              ],
            ),
            bottomNavigationBar: WuyBottomNavigation(
              currentIndex: 1,
              onTap: (index) {
                switch (index) {
                  case 0:
                    context.go(WuyAppRouter.routeSearch);
                    break;
                  case 1:
                    break;
                  case 2:
                    context.go(WuyAppRouter.routeFindFriends);
                    break;
                  case 3:
                    context.go(WuyAppRouter.routeProfile);
                    break;
                }
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: WuyModernInputField(
          controller: _searchController,
          onChanged: _filterFriends,
          hintText: LocalizationKeysAppWuy.wuyFriendsSearch.tr(context),
          prefixIcon: Icons.search,
        ),
      ),
    );
  }

  Widget _buildFriendsList() {
    if (_filteredFriends.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.people_outline,
              size: 64,
              color: WuyAppThemeConfig.wuyTextSecondary,
            ),
            SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
            Text(
              _searchController.text.isEmpty
                  ? LocalizationKeysAppWuy.wuyFriendsNoFriends.tr(context)
                  : LocalizationKeysAppWuy.wuySearchNoResults.tr(context),
              style: ThemeTextStyles.bodyText1.copyWith(
                color: WuyAppThemeConfig.wuyTextSecondary,
              ),
            ),
            if (_searchController.text.isEmpty) ...[
              SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
              ElevatedButton(
                onPressed: () {
                  context.go(WuyAppRouter.routeFindFriends);
                },
                style: WuyAppThemeConfig.wuyPrimaryButton,
                child: Text(
                    LocalizationKeysAppWuy.wuyFriendsAddFriend.tr(context)),
              ),
            ],
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: _filteredFriends.length,
      itemBuilder: (context, index) {
        final friend = _filteredFriends[index];
        return _buildFriendItem(friend);
      },
    );
  }

  Widget _buildFriendItem(FriendModelAppWuy friend) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: 20,
        vertical: 8,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
            spreadRadius: 0,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            context.go(
                WuyAppRouter.routeFriendInfo.replaceAll(':id', friend.id));
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                _buildAvatarWithStatus(friend),
                SizedBox(width: WuyAppThemeConfig.wuyDefaultPadding),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              friend.displayName,
                              style: WuyAppThemeConfig.wuyFriendName.copyWith(
                                fontWeight: FontWeight.w600,
                                fontSize: 16,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (friend.isMonitoring) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: WuyAppThemeConfig.wuyPrimaryColor
                                    .withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.visibility,
                                    size: 12,
                                    color: WuyAppThemeConfig.wuyPrimaryColor,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Monitoring',
                                    style: ThemeTextStyles.caption.copyWith(
                                      color: WuyAppThemeConfig.wuyPrimaryColor,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (friend.lastMessage != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          friend.lastMessage!,
                          style: ThemeTextStyles.bodyText2.copyWith(
                            color: WuyAppThemeConfig.wuyTextSecondary,
                            fontSize: 13,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ] else if (friend.username != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          '@${friend.username}',
                          style: ThemeTextStyles.bodyText2.copyWith(
                            color: WuyAppThemeConfig.wuyTextSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: friend.isOnline
                                  ? WuyAppThemeConfig.wuyOnlineColor
                                  : WuyAppThemeConfig.wuyOfflineColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            friend.isOnline ? 'Online' : 'Offline',
                            style: ThemeTextStyles.caption.copyWith(
                              color: friend.isOnline
                                  ? WuyAppThemeConfig.wuyOnlineColor
                                  : WuyAppThemeConfig.wuyTextSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          if (friend.lastMessageTime != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              '• ${_formatLastMessageTime(friend.lastMessageTime!)}',
                              style: ThemeTextStyles.caption.copyWith(
                                color: WuyAppThemeConfig.wuyTextSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildActionButton(
                      icon: Icons.chat_bubble_outline,
                      color: WuyAppThemeConfig.wuyPrimaryColor,
                      onPressed: () {
                        context.go(
                            '${WuyAppRouter.routeChat.replaceAll(':id', friend.id)}?name=${Uri.encodeComponent(friend.displayName)}');
                      },
                    ),
                    const SizedBox(width: 8),
                    _buildActionButton(
                      icon: Icons.info_outline,
                      color: WuyAppThemeConfig.wuyAccentColor,
                      onPressed: () {
                        context.go(
                            WuyAppRouter.routeFriendInfo.replaceAll(':id', friend.id));
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatarWithStatus(FriendModelAppWuy friend) {
    return Stack(
      children: [
        Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: (friend.isOnline
                        ? WuyAppThemeConfig.wuyOnlineColor
                        : Colors.grey)
                    .withOpacity(0.3),
                blurRadius: 8,
                spreadRadius: 2,
              ),
            ],
          ),
          child: CircleAvatar(
            radius: 28,
            backgroundColor: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.1),
            child: Icon(
              Icons.person,
              color: WuyAppThemeConfig.wuyPrimaryColor,
              size: 28,
            ),
          ),
        ),
        Positioned(
          right: 0,
          bottom: 0,
          child: Container(
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              color: friend.isOnline
                  ? WuyAppThemeConfig.wuyOnlineColor
                  : WuyAppThemeConfig.wuyOfflineColor,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2.5),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: IconButton(
        icon: Icon(icon, size: 20, color: color),
        onPressed: onPressed,
        padding: const EdgeInsets.all(8),
        constraints: const BoxConstraints(
          minWidth: 40,
          minHeight: 40,
        ),
      ),
    );
  }

  String _formatLastMessageTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${time.month}/${time.day}';
    }
  }
}
