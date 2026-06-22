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
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/group_chat/domain/model/chat_message_model.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class ChatService {
  final ImagePicker _imagePicker = ImagePicker();

  Future<ChatMessage?> sendImageMessage(BuildContext context) async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (image != null && context.mounted) {
        return ChatMessage.image(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          senderId: 'me',
          senderName: 'achat_chat_me'.tr(context),
          senderAvatar: '我',
          imageUrl: image.path,
          timestamp: DateTime.now(),
          isMe: true,
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('achat_chat_image_error'.tr(context))),
        );
      }
    }
    return null;
  }

  Future<ChatMessage?> sendFileMessage(BuildContext context) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.any,
        allowMultiple: false,
      );

      if (result != null && result.files.isNotEmpty && context.mounted) {
        final file = result.files.first;
        final fileSize = _formatFileSize(file.size);
        final filePath = file.path ?? '';

        if (filePath.isEmpty) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('achat_chat_file_error'.tr(context))),
            );
          }
          return null;
        }

        return ChatMessage.file(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          senderId: 'me',
          senderName: 'achat_chat_me'.tr(context),
          senderAvatar: '我',
          fileName: file.name,
          filePath: filePath,
          fileSize: fileSize,
          timestamp: DateTime.now(),
          isMe: true,
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('achat_chat_file_error'.tr(context))),
        );
      }
    }
    return null;
  }

  ChatMessage sendTextMessage(String text, BuildContext context) {
    return ChatMessage.text(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      senderId: 'me',
      senderName: 'achat_chat_me'.tr(context),
      senderAvatar: '我',
      content: text,
      timestamp: DateTime.now(),
      isMe: true,
    );
  }

  Future<ChatMessage?> sendVoiceMessage(BuildContext context) async {
    try {
      // Note: ImagePicker doesn't support microphone directly for voice
      // This would need a different package like record or flutter_sound
      // For now, we'll use a placeholder implementation
      await Future.delayed(const Duration(seconds: 2)); // Simulate recording

      if (context.mounted) {
        return ChatMessage(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          senderId: 'me',
          senderName: 'achat_chat_me'.tr(context),
          senderAvatar: '我',
          content: 'achat_chat_voice_message'.tr(context),
          timestamp: DateTime.now(),
          type: MessageType.voice,
          isMe: true,
          voiceUrl: 'placeholder_voice_url',
          voiceDuration: 2, // Simulated duration
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('achat_chat_voice_error'.tr(context))),
        );
      }
    }
    return null;
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  Future<void> deleteMessage(String messageId) async {
    // TODO: Implement message deletion
    await Future.delayed(const Duration(milliseconds: 200));
  }

  Future<void> editMessage(String messageId, String newContent) async {
    // TODO: Implement message editing
    await Future.delayed(const Duration(milliseconds: 200));
  }

  Future<void> forwardMessage(String messageId, String targetChatId) async {
    // TODO: Implement message forwarding
    await Future.delayed(const Duration(milliseconds: 200));
  }
} 
