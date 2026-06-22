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

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/group_chat/domain/model/chat_message_model.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class ChatMessageList extends StatelessWidget {
  final List<ChatMessage> messages;
  final ScrollController scrollController;

  const ChatMessageList({
    super.key,
    required this.messages,
    required this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.only(top: ThemeDimensions.spacingMedium),
      itemCount: messages.length,
      itemBuilder: (context, index) => _buildMessageItem(context, messages[index]),
    );
  }

  Widget _buildMessageItem(BuildContext context, ChatMessage message) {
    final isMe = message.isMe;
    
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacingMedium,
        vertical: ThemeDimensions.spacingSmall,
      ),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isMe) _buildAvatar(message.senderAvatar),
          if (!isMe) const SizedBox(width: ThemeDimensions.spacingSmall),
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.7,
              ),
              child: _buildMessageContent(context, message),
            ),
          ),
          if (isMe) const SizedBox(width: ThemeDimensions.spacingSmall),
          if (isMe) _buildAvatar(message.senderAvatar),
        ],
      ),
    );
  }

  Widget _buildMessageContent(BuildContext context, ChatMessage message) {
    final isMe = message.isMe;
    
    return Container(
                  decoration: BoxDecoration(
        color: isMe
            ? ThemeColors.primary
            : Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(ThemeDimensions.spacingMedium),
          topRight: Radius.circular(ThemeDimensions.spacingMedium),
          bottomLeft: Radius.circular(isMe ? ThemeDimensions.spacingMedium : ThemeDimensions.spacingSmall),
          bottomRight: Radius.circular(isMe ? ThemeDimensions.spacingSmall : ThemeDimensions.spacingMedium),
        ),
        border: isMe
            ? null
            : Border.all(
                color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.1),
                width: 1,
              ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(ThemeDimensions.spacingMedium),
        child: _buildContentByType(context, message),
      ),
    );
  }

  Widget _buildContentByType(BuildContext context, ChatMessage message) {
    switch (message.type) {
      case MessageType.image:
        return _buildImageContent(context, message);
      case MessageType.file:
        return _buildFileContent(context, message);
      case MessageType.voice:
        return _buildVoiceContent(context, message);
      case MessageType.text:
      default:
        return _buildTextContent(context, message);
    }
  }

  Widget _buildTextContent(BuildContext context, ChatMessage message) {
    final isMe = message.isMe;
    
    return Container(
      padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
                                  child: Text(
        message.content,
        style: ThemeTextStyles.bodyMedium.copyWith(
          color: isMe
              ? ThemeColors.white
              : Theme.of(context).colorScheme.onSurface,
        ),
      ),
    );
  }

  Widget _buildImageContent(BuildContext context, ChatMessage message) {
    final isMe = message.isMe;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (message.imageUrl != null)
          GestureDetector(
            onTap: () => _showImagePreview(context, message.imageUrl!),
            child: Container(
              constraints: const BoxConstraints(
                maxWidth: 200,
                maxHeight: 200,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(ThemeDimensions.spacingSmall),
                child: Image.file(
                  File(message.imageUrl!),
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: 200,
                      height: 200,
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      child: Icon(
                        Icons.broken_image,
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                        size: ThemeDimensions.iconSizeMedium,
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        if (message.content.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
            child: Text(
                              message.content,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: isMe
                    ? ThemeColors.white.withValues(alpha: 0.8)
                    : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildFileContent(BuildContext context, ChatMessage message) {
    final isMe = message.isMe;
    
    return Container(
      padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.insert_drive_file,
            color: isMe
                ? ThemeColors.white.withValues(alpha: 0.8)
                : ThemeColors.primary,
            size: ThemeDimensions.iconSizeMedium,
          ),
          const SizedBox(width: ThemeDimensions.spacingSmall),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message.fileName ?? 'achat_chat_unknown_file'.tr(context),
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: isMe
                        ? ThemeColors.white
                        : Theme.of(context).colorScheme.onSurface,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (message.fileSize != null)
                  Text(
                    message.fileSize!,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: isMe
                          ? ThemeColors.white.withValues(alpha: 0.7)
                          : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: ThemeDimensions.spacingSmall),
          IconButton(
            icon: Icon(
              Icons.download,
              color: isMe
                  ? ThemeColors.white.withValues(alpha: 0.8)
                  : ThemeColors.primary,
              size: ThemeDimensions.iconSizeSmall,
            ),
            onPressed: () => _downloadFile(context, message),
            tooltip: 'achat_chat_image_preview'.tr(context),
          ),
        ],
      ),
    );
  }

  Widget _buildVoiceContent(BuildContext context, ChatMessage message) {
    final isMe = message.isMe;
    
    return Container(
      padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.play_arrow,
            color: isMe
                ? ThemeColors.white
                : ThemeColors.primary,
            size: ThemeDimensions.iconSizeMedium,
          ),
          const SizedBox(width: ThemeDimensions.spacingSmall),
          Text(
            '${message.voiceDuration ?? 0}s',
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: isMe
                  ? ThemeColors.white
                  : Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar(String avatar) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: ThemeColors.primary,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
      child: Text(
          avatar,
          style: ThemeTextStyles.bodySmall.copyWith(
            color: ThemeColors.white,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  void _showImagePreview(BuildContext context, String imagePath) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            iconTheme: const IconThemeData(color: Colors.white),
            title: Text(
              'achat_chat_image_preview'.tr(context),
              style: const TextStyle(color: Colors.white),
            ),
          ),
          body: Center(
            child: InteractiveViewer(
              child: Image.file(File(imagePath)),
            ),
          ),
        ),
      ),
    );
  }

  void _downloadFile(BuildContext context, ChatMessage message) {
    // TODO: Implement file download
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('achat_chat_download_started'.tr(context))),
    );
  }
} 
