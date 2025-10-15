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
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

/// Network connection dialog for showing network status and errors
class NetworkConnectionDialog {
  static void show(
    BuildContext context, {
    String? title,
    String? message,
    String? buttonText,
    VoidCallback? onRetry,
    VoidCallback? onDismiss,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Row(
            children: [
              Icon(Icons.wifi_off, color: ThemeColors.error, size: 24),
              const SizedBox(width: 8),
              Text(
                title ?? 'common_network_error'.tr(context),
                style: ThemeTextStyles.headlineSmall,
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                message ?? 'common_network_error_message'.tr(context),
                style: ThemeTextStyles.bodyMedium,
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: ThemeColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: ThemeColors.onSurfaceVariant,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'common_check_connection'.tr(context),
                        style: ThemeTextStyles.bodySmall?.copyWith(
                          color: ThemeColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            if (onDismiss != null)
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  onDismiss();
                },
                child: Text('common_cancel'.tr(context)),
              ),
            if (onRetry != null)
              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  onRetry();
                },
                child: Text(buttonText ?? 'common_retry'.tr(context)),
              ),
            if (onRetry == null && onDismiss == null)
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text('common_ok'.tr(context)),
              ),
          ],
        );
      },
    );
  }

  static void showOfflineDialog(BuildContext context) {
    show(
      context,
      title: 'common_offline_title'.tr(context),
      message: 'common_offline_message'.tr(context),
      buttonText: 'common_ok'.tr(context),
    );
  }

  static void showConnectionErrorDialog(
    BuildContext context, {
    VoidCallback? onRetry,
  }) {
    show(
      context,
      title: 'common_connection_error'.tr(context),
      message: 'common_connection_error_message'.tr(context),
      buttonText: 'common_retry'.tr(context),
      onRetry: onRetry,
      onDismiss: () => Navigator.of(context).pop(),
    );
  }

  static void showTimeoutDialog(BuildContext context, {VoidCallback? onRetry}) {
    show(
      context,
      title: 'common_timeout_title'.tr(context),
      message: 'common_timeout_message'.tr(context),
      buttonText: 'common_retry'.tr(context),
      onRetry: onRetry,
      onDismiss: () => Navigator.of(context).pop(),
    );
  }
}
