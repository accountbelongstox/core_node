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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import '../models_app_wuy/chat_message_model_app_wuy.dart';

class WuySystemMessageBubble extends StatelessWidget {
  final ChatMessageModelAppWuy message;

  const WuySystemMessageBubble({
    super.key,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    if (!message.isSystemMessage) {
      return const SizedBox.shrink();
    }

    return Center(
      child: Container(
        margin: EdgeInsets.symmetric(
          vertical: ThemeDimensions.spacing8,
          horizontal: ThemeDimensions.paddingSizeDefault,
        ),
        padding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.spacing12,
          vertical: ThemeDimensions.spacing8,
        ),
        decoration: BoxDecoration(
          color: ThemeColors.grey200,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _getIconForSystemMessage(),
              size: 14,
              color: _getColorForSystemMessage(),
            ),
            SizedBox(width: ThemeDimensions.spacing8),
            Flexible(
              child: Text(
                message.content,
                style: ThemeTextStyles.caption1.copyWith(
                  color: ThemeColors.secondaryLabel,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getIconForSystemMessage() {
    switch (message.systemMessageType) {
      case 'battery':
        return Icons.battery_std;
      case 'appOpened':
        return Icons.phone_android;
      case 'screenshot':
        return Icons.screenshot;
      case 'locationChanged':
        return Icons.location_on;
      case 'networkChanged':
        return Icons.network_check;
      case 'deviceUnlock':
        return Icons.lock_open;
      case 'appUsage':
        return Icons.access_time;
      default:
        return Icons.info_outline;
    }
  }

  Color _getColorForSystemMessage() {
    switch (message.systemMessageType) {
      case 'battery':
        return ThemeColors.orange;
      case 'appOpened':
        return ThemeColors.blue;
      case 'screenshot':
        return ThemeColors.purple;
      case 'locationChanged':
        return ThemeColors.red;
      case 'networkChanged':
        return ThemeColors.teal;
      case 'deviceUnlock':
        return ThemeColors.green;
      case 'appUsage':
        return ThemeColors.indigo;
      default:
        return ThemeColors.grey500;
    }
  }
}
