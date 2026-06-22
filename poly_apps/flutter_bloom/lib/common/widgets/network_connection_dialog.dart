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

/// Network connection dialog widget
/// Shows network status and connection options
class NetworkConnectionDialog extends StatelessWidget {
  final String? title;
  final String? message;
  final VoidCallback? onRetry;
  final VoidCallback? onCancel;
  final bool showRetryButton;
  final bool showCancelButton;
  final IconData? icon;
  final Color? iconColor;
  final Color? backgroundColor;
  final Color? textColor;

  const NetworkConnectionDialog({
    super.key,
    this.title,
    this.message,
    this.onRetry,
    this.onCancel,
    this.showRetryButton = true,
    this.showCancelButton = true,
    this.icon,
    this.iconColor,
    this.backgroundColor,
    this.textColor,
  });

  /// Show network connection dialog
  static Future<void> show(
    BuildContext context, {
    String? title,
    String? message,
    VoidCallback? onRetry,
    VoidCallback? onCancel,
    bool showRetryButton = true,
    bool showCancelButton = true,
    IconData? icon,
    Color? iconColor,
    Color? backgroundColor,
    Color? textColor,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return NetworkConnectionDialog(
          title: title,
          message: message,
          onRetry: onRetry,
          onCancel: onCancel,
          showRetryButton: showRetryButton,
          showCancelButton: showCancelButton,
          icon: icon,
          iconColor: iconColor,
          backgroundColor: backgroundColor,
          textColor: textColor,
        );
      },
    );
  }

  /// Show network error dialog
  static Future<void> showError(
    BuildContext context, {
    String? message,
    VoidCallback? onRetry,
    VoidCallback? onCancel,
  }) {
    return show(
      context,
      title: 'Network Error',
      message: message ??
          'Unable to connect to the server. Please check your internet connection and try again.',
      onRetry: onRetry,
      onCancel: onCancel,
      icon: Icons.wifi_off,
      iconColor: ThemeColors.error,
    );
  }

  /// Show network timeout dialog
  static Future<void> showTimeout(
    BuildContext context, {
    String? message,
    VoidCallback? onRetry,
    VoidCallback? onCancel,
  }) {
    return show(
      context,
      title: 'Connection Timeout',
      message: message ??
          'The request timed out. Please check your connection and try again.',
      onRetry: onRetry,
      onCancel: onCancel,
      icon: Icons.timer_off,
      iconColor: ThemeColors.warning,
    );
  }

  /// Show no internet connection dialog
  static Future<void> showNoInternet(
    BuildContext context, {
    String? message,
    VoidCallback? onRetry,
    VoidCallback? onCancel,
  }) {
    return show(
      context,
      title: 'No Internet Connection',
      message:
          message ?? 'Please check your internet connection and try again.',
      onRetry: onRetry,
      onCancel: onCancel,
      icon: Icons.signal_wifi_off,
      iconColor: ThemeColors.error,
    );
  }

  /// Show server error dialog
  static Future<void> showServerError(
    BuildContext context, {
    String? message,
    VoidCallback? onRetry,
    VoidCallback? onCancel,
  }) {
    return show(
      context,
      title: 'Server Error',
      message: message ??
          'The server is temporarily unavailable. Please try again later.',
      onRetry: onRetry,
      onCancel: onCancel,
      icon: Icons.error_outline,
      iconColor: ThemeColors.error,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final dialogBackgroundColor = backgroundColor ??
        (isDark ? ThemeColors.black90 : ThemeColors.white100);
    final dialogTextColor = textColor ??
        (isDark ? ThemeColors.textPrimary : ThemeColors.textPrimary);
    final dialogIconColor =
        iconColor ?? (isDark ? ThemeColors.error : ThemeColors.error);

    return Dialog(
      backgroundColor: dialogBackgroundColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusL),
      ),
      child: Container(
        padding: const EdgeInsets.all(ThemeDimensions.paddingLarge),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: dialogIconColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon ?? Icons.wifi_off,
                size: 32,
                color: dialogIconColor,
              ),
            ),

            const SizedBox(height: ThemeDimensions.spacingMedium),

            // Title
            if (title != null) ...[
              Text(
                title!,
                style: ThemeTextStyles.headline.copyWith(
                  color: dialogTextColor,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: ThemeDimensions.spacingSmall),
            ],

            // Message
            if (message != null) ...[
              Text(
                message!,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: dialogTextColor.withOpacity(0.8),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: ThemeDimensions.spacingLarge),
            ],

            // Buttons
            Row(
              children: [
                if (showCancelButton) ...[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        onCancel?.call();
                      },
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: dialogTextColor.withOpacity(0.3),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(ThemeDimensions.radiusM),
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: dialogTextColor,
                        ),
                      ),
                    ),
                  ),
                  if (showRetryButton)
                    const SizedBox(width: ThemeDimensions.spacingSmall),
                ],
                if (showRetryButton) ...[
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        onRetry?.call();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ThemeColors.primary,
                        foregroundColor: ThemeColors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(ThemeDimensions.radiusM),
                        ),
                      ),
                      child: Text(
                        'Retry',
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ThemeColors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Network connection status widget
/// Shows current network status with indicator
class NetworkConnectionStatus extends StatelessWidget {
  final bool isConnected;
  final String? statusText;
  final VoidCallback? onTap;
  final Color? connectedColor;
  final Color? disconnectedColor;
  final double size;

  const NetworkConnectionStatus({
    super.key,
    required this.isConnected,
    this.statusText,
    this.onTap,
    this.connectedColor,
    this.disconnectedColor,
    this.size = 24.0,
  });

  @override
  Widget build(BuildContext context) {
    final connectedColorFinal = connectedColor ?? ThemeColors.success;
    final disconnectedColorFinal = disconnectedColor ?? ThemeColors.error;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: ThemeDimensions.spacingSmall,
          vertical: ThemeDimensions.spacing4,
        ),
        decoration: BoxDecoration(
          color: (isConnected ? connectedColorFinal : disconnectedColorFinal)
              .withOpacity(0.1),
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          border: Border.all(
            color: (isConnected ? connectedColorFinal : disconnectedColorFinal)
                .withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isConnected ? Icons.wifi : Icons.wifi_off,
              size: size,
              color: isConnected ? connectedColorFinal : disconnectedColorFinal,
            ),
            if (statusText != null) ...[
              const SizedBox(width: ThemeDimensions.spacing4),
              Text(
                statusText!,
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: isConnected
                      ? connectedColorFinal
                      : disconnectedColorFinal,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Network connection banner
/// Shows network status as a banner at the top of the screen
class NetworkConnectionBanner extends StatelessWidget {
  final bool isConnected;
  final String? message;
  final VoidCallback? onRetry;
  final Color? backgroundColor;
  final Color? textColor;
  final bool showRetryButton;

  const NetworkConnectionBanner({
    super.key,
    required this.isConnected,
    this.message,
    this.onRetry,
    this.backgroundColor,
    this.textColor,
    this.showRetryButton = true,
  });

  @override
  Widget build(BuildContext context) {
    if (isConnected) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final bannerBackgroundColor = backgroundColor ??
        (isDark ? ThemeColors.error.withOpacity(0.9) : ThemeColors.error);
    final bannerTextColor =
        textColor ?? (isDark ? ThemeColors.white : ThemeColors.white);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacingMedium,
        vertical: ThemeDimensions.spacingSmall,
      ),
      decoration: BoxDecoration(
        color: bannerBackgroundColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(
            Icons.wifi_off,
            color: bannerTextColor,
            size: 20,
          ),
          const SizedBox(width: ThemeDimensions.spacingSmall),
          Expanded(
            child: Text(
              message ?? 'No internet connection',
              style: ThemeTextStyles.bodySmall.copyWith(
                color: bannerTextColor,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          if (showRetryButton && onRetry != null) ...[
            const SizedBox(width: ThemeDimensions.spacingSmall),
            GestureDetector(
              onTap: onRetry,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacingSmall,
                  vertical: ThemeDimensions.spacing4,
                ),
                decoration: BoxDecoration(
                  color: bannerTextColor.withOpacity(0.2),
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.radiusSmall),
                ),
                child: Text(
                  'Retry',
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: bannerTextColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
