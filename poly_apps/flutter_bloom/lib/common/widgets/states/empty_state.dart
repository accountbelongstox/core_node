import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Empty state widget
class EmptyState extends StatelessWidget {
  final IconData? icon;
  final String title;
  final String? message;
  final String? buttonText;
  final VoidCallback? onButtonPressed;
  final Widget? customIllustration;

  const EmptyState({
    super.key,
    this.icon,
    required this.title,
    this.message,
    this.buttonText,
    this.onButtonPressed,
    this.customIllustration,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.hugePadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            customIllustration ??
                Icon(
                  icon ?? Icons.inbox,
                  size: 80,
                  color: ThemeColors.neutralGrey.withOpacity(0.5),
                ),
            SizedBox(height: ThemeDimensions.largePadding),
            Text(
              title,
              style: ThemeTextStyles.headlineMedium.copyWith(
                fontWeight: FontWeight.bold,
                color: ThemeColors.neutralGrey,
              ),
              textAlign: TextAlign.center,
            ),
            if (message != null) ...[
              SizedBox(height: ThemeDimensions.smallPadding),
              Text(
                message!,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (buttonText != null && onButtonPressed != null) ...[
              SizedBox(height: ThemeDimensions.largePadding),
              ElevatedButton(
                onPressed: onButtonPressed,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.primaryBlue,
                  foregroundColor: ThemeColors.neutralWhite,
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.hugePadding,
                    vertical: ThemeDimensions.defaultPadding,
                  ),
                ),
                child: Text(buttonText!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Error state widget
class ErrorState extends StatelessWidget {
  final String title;
  final String? message;
  final String? buttonText;
  final VoidCallback? onRetry;
  final IconData? icon;

  const ErrorState({
    super.key,
    required this.title,
    this.message,
    this.buttonText,
    this.onRetry,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.hugePadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: ThemeColors.errorRed.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon ?? Icons.error_outline,
                size: 56,
                color: ThemeColors.errorRed,
              ),
            ),
            SizedBox(height: ThemeDimensions.largePadding),
            Text(
              title,
              style: ThemeTextStyles.headlineMedium.copyWith(
                fontWeight: FontWeight.bold,
                color: ThemeColors.errorRed,
              ),
              textAlign: TextAlign.center,
            ),
            if (message != null) ...[
              SizedBox(height: ThemeDimensions.smallPadding),
              Text(
                message!,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (buttonText != null && onRetry != null) ...[
              SizedBox(height: ThemeDimensions.largePadding),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: Icon(Icons.refresh),
                label: Text(buttonText!),
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.errorRed,
                  foregroundColor: ThemeColors.neutralWhite,
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.hugePadding,
                    vertical: ThemeDimensions.defaultPadding,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Loading state widget
class LoadingState extends StatelessWidget {
  final String? message;
  final Color? color;

  const LoadingState({
    super.key,
    this.message,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(
            color: color ?? ThemeColors.primaryBlue,
          ),
          if (message != null) ...[
            SizedBox(height: ThemeDimensions.defaultPadding),
            Text(
              message!,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.neutralGrey,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}

/// No internet connection state
class NoConnectionState extends StatelessWidget {
  final VoidCallback? onRetry;

  const NoConnectionState({
    super.key,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return ErrorState(
      title: 'No Internet Connection',
      message: 'Please check your internet connection and try again.',
      buttonText: 'Retry',
      onRetry: onRetry,
      icon: Icons.wifi_off,
    );
  }
}

/// Maintenance mode state
class MaintenanceState extends StatelessWidget {
  final String? message;

  const MaintenanceState({
    super.key,
    this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.hugePadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: ThemeColors.warningYellow.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.build,
                size: 56,
                color: ThemeColors.warningYellow,
              ),
            ),
            SizedBox(height: ThemeDimensions.largePadding),
            Text(
              'Under Maintenance',
              style: ThemeTextStyles.headlineMedium.copyWith(
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: ThemeDimensions.smallPadding),
            Text(
              message ??
                  'We are currently performing maintenance. Please check back later.',
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.neutralGrey,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// Coming soon state
class ComingSoonState extends StatelessWidget {
  final String title;
  final String? message;

  const ComingSoonState({
    super.key,
    required this.title,
    this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.hugePadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: ThemeColors.primaryBlue.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.schedule,
                size: 56,
                color: ThemeColors.primaryBlue,
              ),
            ),
            SizedBox(height: ThemeDimensions.largePadding),
            Text(
              title,
              style: ThemeTextStyles.headlineMedium.copyWith(
                fontWeight: FontWeight.bold,
                color: ThemeColors.primaryBlue,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: ThemeDimensions.smallPadding),
            Text(
              message ?? 'This feature is coming soon!',
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.neutralGrey,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
