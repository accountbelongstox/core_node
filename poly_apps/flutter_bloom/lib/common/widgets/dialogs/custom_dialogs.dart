import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Show confirmation dialog
Future<bool?> showConfirmDialog({
  required BuildContext context,
  required String title,
  required String message,
  String? confirmText,
  String? cancelText,
  Color? confirmColor,
  IconData? icon,
}) {
  return showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      title: icon != null
          ? Row(
              children: [
                Icon(
                  icon,
                  color: confirmColor ?? ThemeColors.primaryBlue,
                  size: 28,
                ),
                SizedBox(width: ThemeDimensions.smallPadding),
                Expanded(child: Text(title)),
              ],
            )
          : Text(title),
      content: Text(
        message,
        style: ThemeTextStyles.bodyMedium,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(
            cancelText ?? 'Cancel',
            style: TextStyle(color: ThemeColors.neutralGrey),
          ),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: ElevatedButton.styleFrom(
            backgroundColor: confirmColor ?? ThemeColors.primaryBlue,
          ),
          child: Text(confirmText ?? 'Confirm'),
        ),
      ],
    ),
  );
}

/// Show success dialog
Future<void> showSuccessDialog({
  required BuildContext context,
  required String title,
  required String message,
  String? buttonText,
  VoidCallback? onPressed,
}) {
  return showDialog(
    context: context,
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: ThemeColors.successGreen.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.check_circle,
              color: ThemeColors.successGreen,
              size: 48,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Text(
            title,
            style: ThemeTextStyles.headlineMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            message,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
      actions: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              onPressed?.call();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.successGreen,
            ),
            child: Text(buttonText ?? 'OK'),
          ),
        ),
      ],
    ),
  );
}

/// Show error dialog
Future<void> showErrorDialog({
  required BuildContext context,
  required String title,
  required String message,
  String? buttonText,
}) {
  return showDialog(
    context: context,
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: ThemeColors.errorRed.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.error_outline,
              color: ThemeColors.errorRed,
              size: 48,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Text(
            title,
            style: ThemeTextStyles.headlineMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            message,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
      actions: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.errorRed,
            ),
            child: Text(buttonText ?? 'OK'),
          ),
        ),
      ],
    ),
  );
}

/// Show loading dialog
void showLoadingDialog({
  required BuildContext context,
  String? message,
}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => PopScope(
      canPop: false,
      child: AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(
              color: ThemeColors.primaryBlue,
            ),
            if (message != null) ...[
              SizedBox(height: ThemeDimensions.defaultPadding),
              Text(
                message,
                style: ThemeTextStyles.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

/// Show bottom sheet
Future<T?> showCustomBottomSheet<T>({
  required BuildContext context,
  required Widget child,
  bool isDismissible = true,
  bool enableDrag = true,
  Color? backgroundColor,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isDismissible: isDismissible,
    enableDrag: enableDrag,
    backgroundColor: backgroundColor ?? ThemeColors.neutralWhite,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.only(
        topLeft: Radius.circular(ThemeDimensions.largeRadius),
        topRight: Radius.circular(ThemeDimensions.largeRadius),
      ),
    ),
    builder: (context) => child,
  );
}

/// Custom action sheet
Future<T?> showActionSheet<T>({
  required BuildContext context,
  required String title,
  required List<ActionSheetItem<T>> actions,
  String? cancelText,
}) {
  return showCustomBottomSheet<T>(
    context: context,
    child: SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
            child: Text(
              title,
              style: ThemeTextStyles.headlineSmall.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Divider(height: 1),
          ...actions.map((action) {
            return ListTile(
              leading: action.icon != null
                  ? Icon(
                      action.icon,
                      color: action.isDestructive
                          ? ThemeColors.errorRed
                          : ThemeColors.primaryBlue,
                    )
                  : null,
              title: Text(
                action.title,
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: action.isDestructive
                      ? ThemeColors.errorRed
                      : ThemeColors.neutralBlack,
                ),
              ),
              onTap: () {
                Navigator.of(context).pop(action.value);
              },
            );
          }),
          Divider(height: 1),
          ListTile(
            title: Text(
              cancelText ?? 'Cancel',
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            onTap: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    ),
  );
}

/// Action sheet item model
class ActionSheetItem<T> {
  final String title;
  final T value;
  final IconData? icon;
  final bool isDestructive;

  const ActionSheetItem({
    required this.title,
    required this.value,
    this.icon,
    this.isDestructive = false,
  });
}

/// Custom snackbar
void showCustomSnackbar({
  required BuildContext context,
  required String message,
  SnackbarType type = SnackbarType.info,
  Duration? duration,
  String? actionLabel,
  VoidCallback? onAction,
}) {
  Color backgroundColor;
  IconData icon;

  switch (type) {
    case SnackbarType.success:
      backgroundColor = ThemeColors.successGreen;
      icon = Icons.check_circle;
      break;
    case SnackbarType.error:
      backgroundColor = ThemeColors.errorRed;
      icon = Icons.error;
      break;
    case SnackbarType.warning:
      backgroundColor = ThemeColors.warningYellow;
      icon = Icons.warning;
      break;
    case SnackbarType.info:
    default:
      backgroundColor = ThemeColors.primaryBlue;
      icon = Icons.info;
  }

  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Row(
        children: [
          Icon(
            icon,
            color: ThemeColors.neutralWhite,
          ),
          SizedBox(width: ThemeDimensions.defaultPadding),
          Expanded(
            child: Text(
              message,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.neutralWhite,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: backgroundColor,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      duration: duration ?? Duration(seconds: 3),
      action: actionLabel != null
          ? SnackBarAction(
              label: actionLabel,
              textColor: ThemeColors.neutralWhite,
              onPressed: onAction ?? () {},
            )
          : null,
    ),
  );
}

enum SnackbarType {
  success,
  error,
  warning,
  info,
}
