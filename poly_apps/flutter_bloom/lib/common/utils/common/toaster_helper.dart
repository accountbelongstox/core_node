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

// Migrated from lib/helper/toaster_helper.dart
// This file provides toast notification utilities for the application

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ToasterHelper {
  /// Show success toast
  static void showSuccess(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: Colors.green,
      textColor: Colors.white,
      icon: Icons.check_circle,
      duration: duration,
      action: action,
    );
  }

  /// Show error toast
  static void showError(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 4),
    SnackBarAction? action,
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: Colors.red,
      textColor: Colors.white,
      icon: Icons.error,
      duration: duration,
      action: action,
    );
  }

  /// Show warning toast
  static void showWarning(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: Colors.orange,
      textColor: Colors.white,
      icon: Icons.warning,
      duration: duration,
      action: action,
    );
  }

  /// Show info toast
  static void showInfo(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: Colors.blue,
      textColor: Colors.white,
      icon: Icons.info,
      duration: duration,
      action: action,
    );
  }

  /// Show custom toast
  static void showCustom(
    BuildContext context,
    String message, {
    Color? backgroundColor,
    Color? textColor,
    IconData? icon,
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: backgroundColor ?? Theme.of(context).primaryColor,
      textColor: textColor ?? Colors.white,
      icon: icon,
      duration: duration,
      action: action,
    );
  }

  /// Show loading toast
  static void showLoading(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 2),
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: Theme.of(context).primaryColor,
      textColor: Colors.white,
      showProgress: true,
      duration: duration,
    );
  }

  /// Show simple toast with theme colors
  static void show(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: duration,
        action: action,
      ),
    );
  }

  /// Show toast with custom widget
  static void showCustomWidget(
    BuildContext context,
    Widget content, {
    Duration duration = const Duration(seconds: 3),
    Color? backgroundColor,
    SnackBarAction? action,
    EdgeInsetsGeometry? margin,
    EdgeInsetsGeometry? padding,
    double? elevation,
    ShapeBorder? shape,
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: content,
        duration: duration,
        backgroundColor: backgroundColor,
        action: action,
        margin: margin,
        padding: padding,
        elevation: elevation,
        shape: shape,
      ),
    );
  }

  /// Show persistent toast (requires manual dismissal)
  static void showPersistent(
    BuildContext context,
    String message, {
    Color? backgroundColor,
    Color? textColor,
    IconData? icon,
    String dismissText = 'Dismiss',
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: backgroundColor ?? Theme.of(context).primaryColor,
      textColor: textColor ?? Colors.white,
      icon: icon,
      duration: const Duration(days: 1), // Very long duration
      action: SnackBarAction(
        label: dismissText,
        textColor: textColor ?? Colors.white,
        onPressed: () {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
        },
      ),
    );
  }

  /// Show toast with undo action
  static void showWithUndo(
    BuildContext context,
    String message,
    VoidCallback onUndo, {
    String undoText = 'Undo',
    Duration duration = const Duration(seconds: 5),
    Color? backgroundColor,
    Color? textColor,
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: backgroundColor ?? Theme.of(context).primaryColor,
      textColor: textColor ?? Colors.white,
      duration: duration,
      action: SnackBarAction(
        label: undoText,
        textColor: textColor ?? Colors.white,
        onPressed: onUndo,
      ),
    );
  }

  /// Show toast with retry action
  static void showWithRetry(
    BuildContext context,
    String message,
    VoidCallback onRetry, {
    String retryText = 'Retry',
    Duration duration = const Duration(seconds: 5),
    Color? backgroundColor,
    Color? textColor,
  }) {
    _showSnackBar(
      context,
      message,
      backgroundColor: backgroundColor ?? Colors.red,
      textColor: textColor ?? Colors.white,
      icon: Icons.error,
      duration: duration,
      action: SnackBarAction(
        label: retryText,
        textColor: textColor ?? Colors.white,
        onPressed: onRetry,
      ),
    );
  }

  /// Hide current toast
  static void hide(BuildContext context) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
  }

  /// Clear all toasts
  static void clearAll(BuildContext context) {
    ScaffoldMessenger.of(context).clearSnackBars();
  }

  /// Show toast with haptic feedback
  static void showWithHaptic(
    BuildContext context,
    String message,
    ToastType type, {
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    // Trigger haptic feedback
    switch (type) {
      case ToastType.success:
        HapticFeedback.lightImpact();
        showSuccess(context, message, duration: duration, action: action);
        break;
      case ToastType.error:
        HapticFeedback.heavyImpact();
        showError(context, message, duration: duration, action: action);
        break;
      case ToastType.warning:
        HapticFeedback.mediumImpact();
        showWarning(context, message, duration: duration, action: action);
        break;
      case ToastType.info:
        HapticFeedback.selectionClick();
        showInfo(context, message, duration: duration, action: action);
        break;
    }
  }

  /// Internal method to show snackbar
  static void _showSnackBar(
    BuildContext context,
    String message, {
    required Color backgroundColor,
    required Color textColor,
    IconData? icon,
    bool showProgress = false,
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    Widget content;
    
    if (showProgress) {
      content = Row(
        children: [
          const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: textColor),
            ),
          ),
        ],
      );
    } else if (icon != null) {
      content = Row(
        children: [
          Icon(icon, color: textColor, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: textColor),
            ),
          ),
        ],
      );
    } else {
      content = Text(
        message,
        style: TextStyle(color: textColor),
      );
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: content,
        backgroundColor: backgroundColor,
        duration: duration,
        action: action,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  /// Show network error toast
  static void showNetworkError(
    BuildContext context, {
    VoidCallback? onRetry,
    String message = 'Network connection failed',
    String retryText = 'Retry',
  }) {
    if (onRetry != null) {
      showWithRetry(context, message, onRetry, retryText: retryText);
    } else {
      showError(context, message);
    }
  }

  /// Show validation error toast
  static void showValidationError(
    BuildContext context,
    String message,
  ) {
    showError(context, message, duration: const Duration(seconds: 2));
  }

  /// Show save success toast
  static void showSaveSuccess(
    BuildContext context, {
    String message = 'Saved successfully',
  }) {
    showSuccess(context, message, duration: const Duration(seconds: 2));
  }

  /// Show delete confirmation toast with undo
  static void showDeleteConfirmation(
    BuildContext context,
    String itemName,
    VoidCallback onUndo, {
    String undoText = 'Undo',
  }) {
    showWithUndo(
      context,
      '$itemName deleted',
      onUndo,
      undoText: undoText,
      duration: const Duration(seconds: 5),
    );
  }

  /// Show copy to clipboard toast
  static void showCopySuccess(
    BuildContext context, {
    String message = 'Copied to clipboard',
  }) {
    HapticFeedback.selectionClick();
    showSuccess(context, message, duration: const Duration(seconds: 1));
  }

  /// Show permission denied toast
  static void showPermissionDenied(
    BuildContext context,
    String permission, {
    VoidCallback? onOpenSettings,
    String settingsText = 'Settings',
  }) {
    final message = '$permission permission denied';
    if (onOpenSettings != null) {
      showWithRetry(
        context,
        message,
        onOpenSettings,
        retryText: settingsText,
      );
    } else {
      showError(context, message);
    }
  }
}

/// Enum for toast types
enum ToastType {
  success,
  error,
  warning,
  info,
}
