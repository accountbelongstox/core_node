import 'package:flutter/material.dart';
import '../theme_app_wuy/theme_config_app_wuy.dart';

/// Wuy App Common Background Widget
/// Provides consistent background decoration across all Wuy app screens
class WuyCommonBackground extends StatelessWidget {
  final Widget child;
  final bool showBackgroundImage;

  const WuyCommonBackground({
    super.key,
    required this.child,
    this.showBackgroundImage = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: showBackgroundImage 
          ? WuyAppThemeConfig.wuyBackgroundDecoration 
          : const BoxDecoration(color: Colors.white),
      child: child,
    );
  }
}
