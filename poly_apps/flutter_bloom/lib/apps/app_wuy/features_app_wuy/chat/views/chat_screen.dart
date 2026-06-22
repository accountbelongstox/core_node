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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../models_app_wuy/chat_message_model_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../services_app_wuy/wuy_unified_service.dart';
import '../../../widgets_app_wuy/wuy_system_message_bubble.dart';

/// Chat Screen for Wuy App
///
/// This screen provides chat functionality for messaging with friends.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyChatTitle.tr(context)
class WuyChatScreen extends StatefulWidget {
  final String friendId;
  final String? friendName;

  const WuyChatScreen({
    super.key,
    required this.friendId,
    this.friendName,
  });

  @override
  State<WuyChatScreen> createState() => _WuyChatScreenState();
}

class _WuyChatScreenState extends State<WuyChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessageModelAppWuy> _messages = [];
  final String _currentUserId = 'current_user';

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _loadMessages() async {
    try {
      final dataManager = WuyUnifiedService();
      final response =
          await dataManager.getChatHistory(friendId: widget.friendId);

      if (mounted) {
        setState(() {
          _messages.addAll(response.data ?? []);
        });
      }
    } catch (e) {
      debugPrint('Error loading messages: $e');
      if (mounted) {
        setState(() {
          _messages.clear();
        });
      }
    }
  }

  void _sendMessage() {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    final message = ChatMessageModelAppWuy(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      chatId: widget.friendId,
      senderId: _currentUserId,
      content: content,
      createdAt: DateTime.now(),
      isRead: false,
    );

    setState(() {
      _messages.add(message);
      _messageController.clear();
    });

    _scrollToBottom();

    // Simulate sending
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) {
        setState(() {
          final index = _messages.indexWhere((m) => m.id == message.id);
          if (index != -1) {
            _messages[index] = _messages[index].copyWith(isRead: true);
          }
        });
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WuyAppThemeConfig.wuyBackgroundColor,
      appBar: AppBar(
        backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
        foregroundColor: ThemeColors.white,
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
        title: Text(
          widget.friendName ?? 'Chat',
          style: WuyAppThemeConfig.wuyAppBarTitle.copyWith(
            color: ThemeColors.white,
            fontWeight: FontWeight.w700,
            fontSize: 22,
            letterSpacing: -0.5,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: ThemeColors.white),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert, color: ThemeColors.white),
            onPressed: () {
              // Show chat options
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    controller: _scrollController,
                    padding:
                        EdgeInsets.all(WuyAppThemeConfig.wuyDefaultPadding),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final message = _messages[index];
                      return _buildMessageBubble(message);
                    },
                  ),
          ),
          _buildMessageInput(),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.chat_bubble_outline,
            size: 64,
            color: WuyAppThemeConfig.wuyTextSecondary,
          ),
          const SizedBox(height: 16),
          Text(
            'Start a conversation',
            style: ThemeTextStyles.bodyText1.copyWith(
              color: WuyAppThemeConfig.wuyTextSecondary,
              fontSize: 18,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessageModelAppWuy message) {
    if (message.isSystemMessage) {
      return WuySystemMessageBubble(message: message);
    }

    final isFromCurrentUser = message.senderId == _currentUserId;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment:
            isFromCurrentUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isFromCurrentUser) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
              child: Text(
                (widget.friendName ?? 'F')[0].toUpperCase(),
                style: const TextStyle(color: ThemeColors.white, fontSize: 12),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.7,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isFromCurrentUser
                    ? WuyAppThemeConfig.wuyPrimaryColor
                    : ThemeColors.grey200,
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: ThemeColors.black.withOpacity(0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                    spreadRadius: 0,
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.content,
                    style: TextStyle(
                      color: isFromCurrentUser
                          ? ThemeColors.white
                          : ThemeColors.black87,
                      fontSize: 15,
                      height: 1.4,
                      letterSpacing: 0.1,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        message.timeText,
                        style: TextStyle(
                          color: isFromCurrentUser
                              ? ThemeColors.white.withOpacity(0.75)
                              : ThemeColors.grey600,
                          fontSize: 11,
                          letterSpacing: 0.1,
                        ),
                      ),
                      if (isFromCurrentUser) ...[
                        const SizedBox(width: 4),
                        Icon(
                          _getStatusIcon(message.isRead),
                          size: 12,
                          color: ThemeColors.white.withOpacity(0.75),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (isFromCurrentUser) ...[
            const SizedBox(width: 8),
            CircleAvatar(
              radius: 16,
              backgroundColor: WuyAppThemeConfig.wuySecondaryColor,
              child: const Text(
                'M',
                style: TextStyle(color: ThemeColors.white, fontSize: 12),
              ),
            ),
          ],
        ],
      ),
    );
  }

  IconData _getStatusIcon(bool isRead) {
    if (isRead) {
      return Icons.done_all;
    } else {
      return Icons.check;
    }
  }

  Widget _buildMessageInput() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: ThemeColors.white,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, -4),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.03),
            blurRadius: 6,
            offset: const Offset(0, -2),
            spreadRadius: 0,
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: ThemeColors.grey100,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: TextField(
                  controller: _messageController,
                  style: const TextStyle(
                    fontSize: 15,
                    letterSpacing: 0.1,
                  ),
                  decoration: InputDecoration(
                    hintText:
                        LocalizationKeysAppWuy.wuyChatInputHint.tr(context),
                    hintStyle: TextStyle(
                      color: WuyAppThemeConfig.wuyTextHint,
                      fontSize: 15,
                      letterSpacing: 0.1,
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                  maxLines: null,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    WuyAppThemeConfig.wuyPrimaryColor,
                    WuyAppThemeConfig.wuyAccentColor,
                  ],
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                    spreadRadius: 0,
                  ),
                  BoxShadow(
                    color: WuyAppThemeConfig.wuyAccentColor.withOpacity(0.2),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                    spreadRadius: -2,
                  ),
                ],
              ),
              child: IconButton(
                icon: const Icon(Icons.send, color: ThemeColors.white, size: 20),
                onPressed: _sendMessage,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
