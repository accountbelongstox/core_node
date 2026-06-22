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
import '../models_app_wuy/friend_model_app_wuy.dart';
import '../theme_app_wuy/theme_config_app_wuy.dart';
import '../router_app_wuy/router_app_wuy.dart';
import '../providers_app_wuy/friends_provider_app_wuy.dart';
import '../localization_app_wuy/localization_keys_app_wuy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class WuyEnhancedFriendListItem extends StatelessWidget {
  final FriendModelAppWuy friend;
  final VoidCallback? onTap;

  const WuyEnhancedFriendListItem({
    super.key,
    required this.friend,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
          onTap: onTap ??
              () {
                context.go(
                    WuyAppRouter.routeFriendInfo.replaceAll(':id', friend.id));
              },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                _buildSquareAvatarWithBadge(context),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildNameRow(context),
                      const SizedBox(height: 6),
                      _buildLastMessageRow(context),
                      const SizedBox(height: 6),
                      _buildStatusRow(context),
                      if (friend.lastLocationTime != null) ...[
                        const SizedBox(height: 4),
                        _buildLocationRow(context),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                _buildActionColumn(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSquareAvatarWithBadge(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: (friend.isOnline
                        ? WuyAppThemeConfig.wuyOnlineColor
                        : Colors.grey)
                    .withOpacity(0.3),
                blurRadius: 8,
                spreadRadius: 1,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: friend.avatarUrl != null
                ? Image.network(
                    friend.avatarUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        _buildDefaultAvatar(),
                  )
                : _buildDefaultAvatar(),
          ),
        ),
        Positioned(
          right: 2,
          bottom: 2,
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
        if (friend.unreadMessageCount > 0)
          Positioned(
            right: -4,
            top: -4,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
              constraints: const BoxConstraints(
                minWidth: 22,
                minHeight: 22,
              ),
              child: Center(
                child: Text(
                  friend.unreadMessageCount > 99
                      ? '99+'
                      : friend.unreadMessageCount.toString(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildDefaultAvatar() {
    return Container(
      color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.1),
      child: Icon(
        Icons.person,
        color: WuyAppThemeConfig.wuyPrimaryColor,
        size: 32,
      ),
    );
  }

  Widget _buildNameRow(BuildContext context) {
    return Row(
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
      ],
    );
  }

  Widget _buildLastMessageRow(BuildContext context) {
    if (friend.lastMessage == null || friend.lastMessage!.isEmpty) {
      return Text(
        '@${friend.username}',
        style: ThemeTextStyles.bodyText2.copyWith(
          color: WuyAppThemeConfig.wuyTextSecondary,
          fontSize: 13,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      );
    }

    return Row(
      children: [
        Expanded(
          child: Text(
            friend.lastMessage!,
            style: ThemeTextStyles.bodyText2.copyWith(
              color: WuyAppThemeConfig.wuyTextSecondary,
              fontSize: 13,
              fontWeight: friend.unreadMessageCount > 0
                  ? FontWeight.w600
                  : FontWeight.normal,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (friend.lastMessageTime != null) ...[
          const SizedBox(width: 8),
          Text(
            _formatLastMessageTime(friend.lastMessageTime!),
            style: ThemeTextStyles.caption.copyWith(
              color: WuyAppThemeConfig.wuyTextSecondary,
              fontSize: 11,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildStatusRow(BuildContext context) {
    return Row(
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
          friend.isOnline
              ? LocalizationKeysAppWuy.wuyStatusOnline.tr(context)
              : _formatLastSeen(),
          style: ThemeTextStyles.caption.copyWith(
            color: friend.isOnline
                ? WuyAppThemeConfig.wuyOnlineColor
                : WuyAppThemeConfig.wuyTextSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildLocationRow(BuildContext context) {
    return Row(
      children: [
        Icon(
          Icons.location_on,
          size: 12,
          color: WuyAppThemeConfig.wuyAccentColor,
        ),
        const SizedBox(width: 4),
        Text(
          '${LocalizationKeysAppWuy.wuyLastLocation.tr(context)}: ${_formatLastLocationTime(friend.lastLocationTime!)}',
          style: ThemeTextStyles.caption.copyWith(
            color: WuyAppThemeConfig.wuyTextSecondary,
            fontSize: 11,
          ),
        ),
      ],
    );
  }

  Widget _buildActionColumn(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildMonitoringToggle(context),
        const SizedBox(height: 8),
        _buildActionButton(
          icon: Icons.chat_bubble_outline,
          color: WuyAppThemeConfig.wuyPrimaryColor,
          onPressed: () {
            context.go(
                '${WuyAppRouter.routeChat.replaceAll(':id', friend.id)}?name=${Uri.encodeComponent(friend.displayName)}');
          },
        ),
        const SizedBox(height: 8),
        _buildActionButton(
          icon: Icons.info_outline,
          color: WuyAppThemeConfig.wuyAccentColor,
          onPressed: () {
            context.go(
                WuyAppRouter.routeFriendInfo.replaceAll(':id', friend.id));
          },
        ),
      ],
    );
  }

  Widget _buildMonitoringToggle(BuildContext context) {
    return Consumer<FriendsProviderAppWuy>(
      builder: (context, friendsProvider, child) {
        return Container(
          decoration: BoxDecoration(
            color: friend.isMonitoring
                ? WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.1)
                : Colors.grey.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () async {
              try {
                await friendsProvider.toggleMonitoring(friend.id);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        friend.isMonitoring
                            ? LocalizationKeysAppWuy.wuyMonitoringDisabled
                                .tr(context)
                            : LocalizationKeysAppWuy.wuyMonitoringEnabled
                                .tr(context),
                      ),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        LocalizationKeysAppWuy.wuyMonitoringError.tr(context),
                      ),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Icon(
                friend.isMonitoring ? Icons.visibility : Icons.visibility_off,
                size: 20,
                color: friend.isMonitoring
                    ? WuyAppThemeConfig.wuyPrimaryColor
                    : Colors.grey,
              ),
            ),
          ),
        );
      },
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

  String _formatLastSeen() {
    if (friend.lastSeen == null) return 'Offline';

    final now = DateTime.now();
    final difference = now.difference(friend.lastSeen!);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}h ago';
    } else {
      return '${difference.inDays}d ago';
    }
  }

  String _formatLastLocationTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h';
    } else {
      return '${difference.inDays}d';
    }
  }
}
