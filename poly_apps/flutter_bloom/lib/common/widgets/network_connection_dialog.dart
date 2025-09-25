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
import 'package:qyflutter/apps/app_achat/resources_app_achat/assets_images_app_achat.dart';

/// Common network connection dialog utility
/// This dialog can be used across all pages to show network connection status
class NetworkConnectionDialog {
  /// Show network connection dialog
  /// 
  /// [context] - BuildContext for showing the dialog
  /// [title] - Optional custom title (defaults to '网络连接中')
  /// [message] - Optional custom message (defaults to '正在连接网络，请稍候...')
  /// [buttonText] - Optional custom button text (defaults to '确定')
  static Future<void> show(
    BuildContext context, {
    String? title,
    String? message,
    String? buttonText,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: [
            Image.asset(
              AChatAppAssetsImages.achat_loading,
              width: 24,
              height: 24,
              errorBuilder: (context, error, stackTrace) => const Icon(
                Icons.wifi_off,
                size: 24,
                color: Colors.orange,
              ),
            ),
            const SizedBox(width: 8),
            Text(title ?? '网络连接中'),
          ],
        ),
        content: Text(message ?? '正在连接网络，请稍候...'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(buttonText ?? '确定'),
          ),
        ],
      ),
    );
  }
}
