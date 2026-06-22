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
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class ChatInputBar extends StatelessWidget {
  final TextEditingController messageController;
  final VoidCallback onSendText;
  final VoidCallback onSendImage;
  final VoidCallback onSendFile;
  final VoidCallback onSendVoice;

  const ChatInputBar({
    super.key,
    required this.messageController,
    required this.onSendText,
    required this.onSendImage,
    required this.onSendFile,
    required this.onSendVoice,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacingMedium,
        vertical: ThemeDimensions.spacingMedium,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            offset: const Offset(0, -1),
            blurRadius: 4,
          ),
        ],
      ),
      child: Row(
        children: [
          _buildAttachmentButton(context),
          const SizedBox(width: ThemeDimensions.spacingSmall),
          Expanded(
            child: _buildTextField(context),
          ),
          const SizedBox(width: ThemeDimensions.spacingSmall),
          _buildEmojiButton(context),
          const SizedBox(width: ThemeDimensions.spacingSmall),
          _buildSendButton(context),
        ],
      ),
    );
  }

  Widget _buildAttachmentButton(BuildContext context) {
    return IconButton(
      icon: Icon(
        Icons.add_circle_outline,
        color: ThemeColors.primary,
        size: 28,
      ),
      tooltip: 'achat_chat_add_attachment'.tr(context),
      onPressed: () => _showAttachmentOptions(context),
    );
  }

  Widget _buildTextField(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(ThemeDimensions.spacingMedium),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.2),
        ),
      ),
      child: TextField(
        controller: messageController,
        decoration: InputDecoration(
          hintText: 'achat_chat_input_hint'.tr(context),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.spacingMedium,
            vertical: ThemeDimensions.spacingSmall,
          ),
        ),
        maxLines: null,
        textInputAction: TextInputAction.send,
        onSubmitted: (_) => onSendText(),
      ),
    );
  }

  Widget _buildEmojiButton(BuildContext context) {
    return IconButton(
      icon: Icon(
        Icons.emoji_emotions_outlined,
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
        size: ThemeDimensions.iconSizeMedium,
      ),
      onPressed: () => _showEmojiPicker(context),
      tooltip: 'achat_chat_emoji'.tr(context),
    );
  }

  Widget _buildSendButton(BuildContext context) {
    final hasText = messageController.text.trim().isNotEmpty;
    return IconButton(
      icon: Icon(
        Icons.send,
        color: hasText
            ? ThemeColors.primary
            : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3),
        size: ThemeDimensions.iconSizeMedium,
      ),
      onPressed: hasText ? onSendText : null,
      tooltip: 'achat_chat_send'.tr(context),
    );
  }

  void _showAttachmentOptions(BuildContext context) {
              showModalBottomSheet(
                context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
        child: Column(
          mainAxisSize: MainAxisSize.min,
                    children: [
            Text(
              'achat_chat_attachment_options'.tr(context),
              style: ThemeTextStyles.titleMedium,
            ),
            const SizedBox(height: ThemeDimensions.spacingMedium),
            _buildAttachmentOption(
              context,
              icon: Icons.image,
              title: 'achat_chat_image'.tr(context),
              subtitle: 'achat_chat_image_subtitle'.tr(context),
                        onTap: () {
                Navigator.pop(context);
                          onSendImage();
                        },
                      ),
            _buildAttachmentOption(
              context,
              icon: Icons.attach_file,
              title: 'achat_chat_file'.tr(context),
              subtitle: 'achat_chat_file_subtitle'.tr(context),
                        onTap: () {
                Navigator.pop(context);
                          onSendFile();
                        },
                      ),
            _buildAttachmentOption(
              context,
              icon: Icons.mic,
              title: 'achat_chat_voice'.tr(context),
              subtitle: 'achat_chat_voice_subtitle'.tr(context),
              onTap: () {
                Navigator.pop(context);
                onSendVoice();
              },
            ),
                    ],
                  ),
                ),
              );
  }

  Widget _buildAttachmentOption(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(
        icon,
        color: ThemeColors.primary,
        size: ThemeDimensions.iconSizeMedium,
      ),
      title: Text(title, style: ThemeTextStyles.bodyMedium),
      subtitle: Text(
        subtitle,
        style: ThemeTextStyles.bodySmall.copyWith(
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
        ),
      ),
      onTap: onTap,
    );
  }

  void _showEmojiPicker(BuildContext context) {
    // TODO: Implement emoji picker
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('achat_chat_emoji_coming_soon'.tr(context))),
    );
  }
} 
