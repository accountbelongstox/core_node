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
import '../resources_app_wuy/assets_icons_app_wuy.dart';
import '../theme_app_wuy/theme_config_app_wuy.dart';

/// Wuy App Common Logo Widget
/// Provides consistent logo display across all Wuy app screens
class WuyCommonLogo extends StatelessWidget {
  final double? width;
  final double? height;
  final EdgeInsets? margin;
  final BoxFit fit;

  const WuyCommonLogo({
    super.key,
    this.width,
    this.height,
    this.margin,
    this.fit = BoxFit.contain,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin ?? const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Image.asset(
          WuyAppAssetsIcons.logo,
          width: width ?? 84,
          height: height ?? 84,
          fit: fit,
          errorBuilder: (context, error, stackTrace) {
            debugPrint('Logo image failed to load: $error');
            return Container(
              width: width ?? 84,
              height: height ?? 84,
              decoration: BoxDecoration(
                color: WuyAppThemeConfig.wuyPrimaryColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.apps,
                color: Colors.white,
                size: (width ?? 84) * 0.57, // 48/84 ratio
              ),
            );
          },
        ),
      ),
    );
  }
}
