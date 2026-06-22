// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../providers_app_wuy/friends_provider_app_wuy.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../config_app_wuy/storage_app_wuy.dart';

// Exact Tailwind CSS color values
class _TailwindColors {
  // Purple colors
  static const Color purple100 = Color(0xFFF3E8FF); // bg-purple-100
  static const Color purple600 = Color(0xFF9333EA); // text-purple-600

  // Slate colors
  static const Color slate300 = Color(0xFFCBD5E1); // bg-slate-300
  static const Color slate400 = Color(0xFF94A3B8); // text-slate-400
  static const Color slate500 = Color(0xFF64748B); // text-slate-500

  // Blue colors
  static const Color blue500 = Color(0xFF3B82F6); // bg-blue-500
}

/// Friends List Screen for Wuy App
///
/// 1:1 implementation matching React version FriendsList.tsx and actual UI images
/// Features:
/// - MobileLayout with background gradient orbs
/// - Header with title showing friend count and action buttons (filter + add)
/// - Search input with phone number placeholder
/// - GlassCard for each friend item with:
///   - Avatar, name, relationship tag (with exact Tailwind colors)
///   - Last active time with clock icon
///   - Last message preview with chat bubble icon
///   - Unread message count badge
///   - Monitoring status toggle (with exact Tailwind colors)
///   - Location and details link
/// - InkWell ripple effect on friend card tap
/// - Icon outer circle and shadow effects
class WuyFriendsListScreen extends StatefulWidget {
  const WuyFriendsListScreen({super.key});

  @override
  State<WuyFriendsListScreen> createState() => _WuyFriendsListScreenState();
}

class _WuyFriendsListScreenState extends State<WuyFriendsListScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<FriendModelAppWuy> _filteredFriends = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final friendsProvider =
          Provider.of<FriendsProviderAppWuy>(context, listen: false);
      if (friendsProvider.friends.isEmpty) {
        friendsProvider.loadFriends();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _filterFriends(String query, List<FriendModelAppWuy> allFriends) {
    setState(() {
      if (query.isEmpty) {
        _filteredFriends = allFriends;
      } else {
        _filteredFriends = allFriends.where((friend) {
          return friend.displayName
                  .toLowerCase()
                  .contains(query.toLowerCase()) ||
              friend.username.toLowerCase().contains(query.toLowerCase()) ||
              (friend.phoneNumber?.contains(query) ?? false);
        }).toList();
      }
    });
  }

  void _toggleMonitor(String friendId) {
    final friendsProvider =
        Provider.of<FriendsProviderAppWuy>(context, listen: false);
    friendsProvider.toggleMonitoring(friendId);
    // Save to storage
    final storage = StorageAppWuy.instance;
    final friendsList = friendsProvider.friends
        .map((f) => {
              'id': f.id,
              'isMonitoring': f.isMonitoring,
            })
        .toList();
    storage.setFriendsList(friendsList);
  }

  String _formatLastActive(DateTime? lastSeen) {
    if (lastSeen == null) {
      return LocalizationKeysAppWuy.wuyFriendsOffline.tr(context);
    }
    final now = DateTime.now();
    final difference = now.difference(lastSeen);

    if (difference.inMinutes < 1) {
      return LocalizationKeysAppWuy.wuyFriendsOnline.tr(context);
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}${LocalizationKeysAppWuy.wuyTimeMinutesAgo.tr(context)}';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}${LocalizationKeysAppWuy.wuyTimeHoursAgo.tr(context)}';
    } else {
      return '${difference.inDays}${LocalizationKeysAppWuy.wuyTimeDaysAgo.tr(context)}';
    }
  }

  String _truncateMessage(String? message, int maxLength) {
    if (message == null || message.isEmpty) return '';
    if (message.length <= maxLength) return message;
    return '${message.substring(0, maxLength)}...';
  }

  @override
  Widget build(BuildContext context) {
    final storage = StorageAppWuy.instance;
    final isDarkMode = storage.isDarkMode();

    return Consumer<FriendsProviderAppWuy>(
      builder: (context, friendsProvider, child) {
        final allFriends = friendsProvider.friends;
        final displayFriends =
            _filteredFriends.isEmpty && _searchController.text.isEmpty
                ? allFriends
                : _filteredFriends;

        return Scaffold(
          backgroundColor:
              isDarkMode ? ThemeColors.grey900 : ThemeColors.grey50,
          body: Stack(
            children: [
              // Background gradient orbs (matching React version)
              Positioned(
                top: -MediaQuery.of(context).size.height * 0.2,
                left: -MediaQuery.of(context).size.width * 0.2,
                child: Container(
                  width: MediaQuery.of(context).size.width * 0.8,
                  height: MediaQuery.of(context).size.height * 0.5,
                  decoration: BoxDecoration(
                    color: ThemeColors.blue.withOpacity(0.2),
                    shape: BoxShape.circle,
                  ),
                  child: ClipOval(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 100, sigmaY: 100),
                      child: Container(),
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: -MediaQuery.of(context).size.height * 0.1,
                right: -MediaQuery.of(context).size.width * 0.1,
                child: Container(
                  width: MediaQuery.of(context).size.width * 0.8,
                  height: MediaQuery.of(context).size.height * 0.5,
                  decoration: BoxDecoration(
                    color: ThemeColors.purple.withOpacity(0.2),
                    shape: BoxShape.circle,
                  ),
                  child: ClipOval(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 100, sigmaY: 100),
                      child: Container(),
                    ),
                  ),
                ),
              ),
              // Content
              SafeArea(
                child: Column(
                  children: [
                    // Header (matching image: title with count, filter icon + add icon)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Title with count (matching image: "好友 (2)")
                          Text(
                            '${LocalizationKeysAppWuy.wuyTabFriends.tr(context)} (${displayFriends.length})',
                            style: ThemeTextStyles.title1Bold.copyWith(
                              fontSize: 20, // text-lg in React Header
                              fontWeight: FontWeight.bold, // font-bold
                              color: isDarkMode
                                  ? ThemeColors.white
                                  : ThemeColors.black,
                            ),
                          ),
                          // Action buttons (matching image: filter + add icons)
                          Row(
                            children: [
                              // Filter icon with outer circle and shadow (matching image)
                              GestureDetector(
                                onTap: () {
                                  // TODO: Implement filter functionality
                                },
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: ThemeColors.white.withOpacity(0.1),
                                    border: Border.all(
                                      color: ThemeColors.blue.withOpacity(0.2),
                                      width: 1,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color:
                                            ThemeColors.black.withOpacity(0.1),
                                        blurRadius: 4,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    Icons.tune,
                                    size: 24,
                                    color: ThemeColors.blue, // text-blue-600
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Add icon with outer circle and shadow (matching image)
                              GestureDetector(
                                onTap: () => context
                                    .go(WuyAppRouter.getAddFriendRoute()),
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: ThemeColors.white.withOpacity(0.1),
                                    border: Border.all(
                                      color: ThemeColors.blue.withOpacity(0.2),
                                      width: 1,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color:
                                            ThemeColors.black.withOpacity(0.1),
                                        blurRadius: 4,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    Icons.add,
                                    size: 24,
                                    color: ThemeColors.blue, // text-blue-600
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Search (matching image: placeholder "搜索手机号")
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Container(
                        margin: const EdgeInsets.only(
                            bottom: 16), // space-y-4 (16px)
                        child: Stack(
                          children: [
                            GlassCard(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 40, vertical: 12),
                              borderRadius: BorderRadius.circular(12),
                              child: TextField(
                                controller: _searchController,
                                onChanged: (query) =>
                                    _filterFriends(query, allFriends),
                                decoration: InputDecoration(
                                  hintText: LocalizationKeysAppWuy
                                      .wuyFriendSearchPhone
                                      .tr(context),
                                  border: InputBorder.none,
                                  hintStyle:
                                      ThemeTextStyles.bodyMedium.copyWith(
                                    color: ThemeColors.grey400,
                                  ),
                                ),
                                style: ThemeTextStyles.bodyMedium.copyWith(
                                  color: isDarkMode
                                      ? ThemeColors.white
                                      : ThemeColors.black,
                                ),
                              ),
                            ),
                            Positioned(
                              left: 12, // left-3 (12px)
                              top: 14, // top-3.5 (14px)
                              child: Icon(
                                Icons.search,
                                size: 18,
                                color: ThemeColors.grey400, // text-slate-400
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Friends List (matching image: space-y-3 = 12px margin)
                    Expanded(
                      child: displayFriends.isEmpty
                          ? Center(
                              child: Text(
                                LocalizationKeysAppWuy.wuyFriendsNoFriends
                                    .tr(context),
                                style: ThemeTextStyles.bodyMedium.copyWith(
                                  color: ThemeColors.grey500,
                                ),
                              ),
                            )
                          : ListView.builder(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 20),
                              itemCount: displayFriends.length,
                              itemBuilder: (context, index) {
                                final friend = displayFriends[index];
                                return Padding(
                                  padding: const EdgeInsets.only(
                                      bottom: 12), // space-y-3 (12px)
                                  child: _buildFriendCard(
                                      context, friend, isDarkMode),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
              // Bottom Navigation
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: WuyBottomNavigation(
                  currentRoute: GoRouterState.of(context).uri.toString(),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFriendCard(
    BuildContext context,
    FriendModelAppWuy friend,
    bool isDarkMode,
  ) {
    // Matching React: GlassCard className="flex flex-col gap-3"
    // Wrap with InkWell for ripple effect on tap (matching React's active:bg-black/5)
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.go(
          WuyAppRouter.getFriendInfoRoute(friend.id),
        ),
        borderRadius: BorderRadius.circular(16),
        splashColor: ThemeColors.black.withOpacity(0.05), // active:bg-black/5
        highlightColor: ThemeColors.black.withOpacity(0.02),
        child: GlassCard(
          padding: const EdgeInsets.all(16), // p-4
          borderRadius: BorderRadius.circular(16), // rounded-2xl
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Main content row (matching React: flex items-center gap-4)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Friend info (matching React: flex-1 flex items-center gap-4)
                  Expanded(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 24, // w-12 h-12 (48px) -> radius 24
                          backgroundImage: friend.avatarUrl != null
                              ? NetworkImage(friend.avatarUrl!)
                              : null,
                          backgroundColor: ThemeColors.grey300, // bg-slate-200
                        ),
                        const SizedBox(width: 16), // gap-4
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Name and relation (matching React: flex items-center gap-2)
                              Row(
                                children: [
                                  Text(
                                    friend.displayName,
                                    style: ThemeTextStyles.title3Bold.copyWith(
                                      fontWeight: FontWeight.bold, // font-bold
                                      fontSize: 16,
                                      color: isDarkMode
                                          ? ThemeColors.white
                                          : ThemeColors.black,
                                    ),
                                  ),
                                  const SizedBox(width: 8), // gap-2
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 2,
                                    ), // px-2 py-0.5
                                    decoration: BoxDecoration(
                                      color: _TailwindColors
                                          .purple100, // bg-purple-100 (exact Tailwind)
                                      borderRadius: BorderRadius.circular(
                                          99), // rounded-full
                                    ),
                                    child: Text(
                                      friend.relationship ?? '',
                                      style: ThemeTextStyles.caption2.copyWith(
                                        fontSize: 10, // text-[10px]
                                        color: _TailwindColors
                                            .purple600, // text-purple-600 (exact Tailwind)
                                        fontWeight:
                                            FontWeight.bold, // font-bold
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4), // mt-1
                              // Last active with clock icon (matching image)
                              Row(
                                children: [
                                  Icon(
                                    Icons.access_time,
                                    size: 10,
                                    color:
                                        ThemeColors.grey500, // text-slate-500
                                  ),
                                  const SizedBox(width: 4), // gap-1
                                  Text(
                                    _formatLastActive(friend.lastSeen),
                                    style: ThemeTextStyles.caption2.copyWith(
                                      fontSize: 12, // text-xs
                                      color:
                                          ThemeColors.grey500, // text-slate-500
                                    ),
                                  ),
                                ],
                              ),
                              // Last message preview with chat bubble icon (matching image)
                              if (friend.lastMessage != null &&
                                  friend.lastMessage!.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.chat_bubble_outline,
                                      size: 12,
                                      color: ThemeColors.grey500,
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        _truncateMessage(
                                            friend.lastMessage, 30),
                                        style:
                                            ThemeTextStyles.caption2.copyWith(
                                          fontSize: 12,
                                          color: ThemeColors.grey500,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                        maxLines: 1,
                                      ),
                                    ),
                                    // Unread message count badge (matching image: red circle with number)
                                    if (friend.unreadMessageCount > 0) ...[
                                      const SizedBox(width: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: ThemeColors.red,
                                          shape: BoxShape.circle,
                                        ),
                                        child: Text(
                                          '${friend.unreadMessageCount}',
                                          style:
                                              ThemeTextStyles.caption2.copyWith(
                                            fontSize: 10,
                                            color: ThemeColors.white,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Monitor toggle (matching image: "监控状态" label + toggle)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        LocalizationKeysAppWuy.wuyFriendMonitoringStatus
                            .tr(context),
                        style: ThemeTextStyles.caption2.copyWith(
                          fontSize: 10, // text-[10px]
                          fontWeight: FontWeight.w500,
                          color: ThemeColors.grey400, // text-slate-400
                        ),
                      ),
                      const SizedBox(height: 4), // gap-1
                      // Prevent InkWell ripple from triggering on toggle tap
                      GestureDetector(
                        onTap: () => _toggleMonitor(friend.id),
                        behavior: HitTestBehavior
                            .opaque, // Prevent ripple from propagating
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          width: 48, // w-12 (48px)
                          height: 24, // h-6 (24px)
                          padding: const EdgeInsets.all(2), // p-1
                          decoration: BoxDecoration(
                            color: friend.isMonitoring
                                ? _TailwindColors
                                    .blue500 // bg-blue-500 (exact Tailwind)
                                : _TailwindColors
                                    .slate300, // bg-slate-300 (exact Tailwind, more visible)
                            borderRadius:
                                BorderRadius.circular(12), // rounded-full
                          ),
                          child: AnimatedAlign(
                            duration: const Duration(milliseconds: 300),
                            alignment: friend.isMonitoring
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Container(
                              width: 20, // w-4 (20px)
                              height: 20, // h-4 (20px)
                              decoration: BoxDecoration(
                                color: ThemeColors.white, // bg-white
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: ThemeColors.black.withOpacity(0.1),
                                    blurRadius: 2,
                                    offset: const Offset(0, 1),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // Bottom section (matching React: pt-3 border-t border-black/5)
              Padding(
                padding: const EdgeInsets.only(top: 12), // pt-3
                child: Container(
                  padding: const EdgeInsets.only(top: 12),
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(
                        color: isDarkMode
                            ? ThemeColors.white.withOpacity(0.1)
                            : ThemeColors.black.withOpacity(
                                0.05), // border-black/5 dark:border-white/10
                        width: 1,
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Location (matching React: flex items-center gap-1 max-w-[200px] truncate)
                      Expanded(
                        child: Row(
                          children: [
                            Icon(
                              Icons.location_on,
                              size: 12,
                              color: ThemeColors.grey500, // text-slate-500
                            ),
                            const SizedBox(width: 4), // gap-1
                            Flexible(
                              child: Text(
                                friend.lastLocation?['address'] ?? '',
                                style: ThemeTextStyles.caption2.copyWith(
                                  fontSize: 12, // text-xs
                                  color: ThemeColors.grey500, // text-slate-500
                                ),
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Details link (matching React: text-blue-500 flex items-center font-medium)
                      GestureDetector(
                        onTap: () => context.go(
                          WuyAppRouter.getFriendInfoRoute(friend.id),
                        ),
                        behavior: HitTestBehavior
                            .opaque, // Prevent ripple from propagating
                        child: Row(
                          children: [
                            Text(
                              LocalizationKeysAppWuy.wuyFriendDetails
                                  .tr(context),
                              style: ThemeTextStyles.caption2.copyWith(
                                fontSize: 12, // text-xs
                                color: ThemeColors.blue, // text-blue-500
                                fontWeight: FontWeight.w500, // font-medium
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              Icons.chevron_right,
                              size: 12,
                              color: ThemeColors.blue,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
