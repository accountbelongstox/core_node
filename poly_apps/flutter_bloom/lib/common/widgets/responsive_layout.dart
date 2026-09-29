import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/provider_status/screen_size_provider.dart';

class ResponsiveLayout extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final Widget? desktop;

  const ResponsiveLayout({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
  });

  @override
  Widget build(BuildContext context) {
    final screenSizeProvider = context.watch<ScreenSizeProvider>();

    if (screenSizeProvider.isDesktop && desktop != null) {
      return desktop!;
    } else if (screenSizeProvider.isTablet && tablet != null) {
      return tablet!;
    }
    return mobile;
  }
}
