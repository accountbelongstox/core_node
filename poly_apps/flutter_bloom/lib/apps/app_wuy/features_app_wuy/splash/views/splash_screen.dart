// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../services_app_wuy/wuy_auth_state_manager.dart';

/// Splash Screen for Wuy App
///
/// This screen displays the app splash screen during startup.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuySplashTitle.tr(context)
class WuySplashScreen extends StatefulWidget {
  const WuySplashScreen({super.key});

  @override
  State<WuySplashScreen> createState() => _WuySplashScreenState();
}

class _WuySplashScreenState extends State<WuySplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigateToHome();
  }

  Future<void> _navigateToHome() async {
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) {
      // Use auth state manager to determine the correct initial route
      final authStateManager = WuyAuthStateManager.instance;
      final initialRoute = authStateManager.getInitialRoute();
      debugPrint('Splash: Navigating to initial route: $initialRoute');
      context.go(initialRoute);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.primary,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.apps,
              size: 100,
              color: ThemeColors.white,
            ),
            const SizedBox(height: 20),
            Text(
              LocalizationKeysAppWuy.wuySplashTitle.tr(context),
              style: ThemeTextStyles.displayLarge.copyWith(
                color: ThemeColors.white,
              ),
            ),
            const SizedBox(height: 20),
            CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.white),
            ),
          ],
        ),
      ),
    );
  }
}
