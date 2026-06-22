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
// Changes: Updated to use proper theming and follow new Flutter guide standards
// Note to other AIs: This widget now uses ThemeColors and ThemeDimensions

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_list/domain/model/chat_list_model.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class ChatListItem extends StatelessWidget {
  final ChatItemModel chat;
  final VoidCallback? onTap;
  final bool isSelected;

  const ChatListItem({
    super.key,
    required this.chat,
    this.onTap,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: _buildAvatar(),
      title: _buildTitle(),
      subtitle: _buildSubtitle(),
      trailing: _buildTrailing(),
      onTap: onTap,
      selected: isSelected,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacingMedium,
        vertical: ThemeDimensions.spacingSmall,
      ),
    );
  }

  Widget _buildAvatar() {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: chat.color,
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
    );
  }

  Widget _buildTitle() {
    return Row(
      children: [
        Expanded(
          child: Text(
            chat.name,
            style: TextStyle(
              fontWeight: chat.unreadCount > 0 ? FontWeight.bold : FontWeight.normal,
              fontSize: 15,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (chat.status == ChatItemStatus.pinned)
          const Icon(Icons.push_pin, size: 16, color: Colors.grey),
        if (chat.type == ChatItemType.group)
          const Icon(Icons.group, size: 16, color: Colors.grey),
      ],
    );
  }

  Widget _buildSubtitle() {
    return Text(
      chat.message,
      style: TextStyle(
        fontSize: 13,
        color: chat.unreadCount > 0 ? Colors.black87 : Colors.grey,
        fontWeight: chat.unreadCount > 0 ? FontWeight.w500 : FontWeight.normal,
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }

  Widget _buildTrailing() {
    return Column(
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
    );
  }
} 
