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
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_example/config_app_example/storage_app_example.dart';
import 'package:qyflutter/apps/app_example/controller_app_example/settings_controller_app_example.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';
import 'package:provider/provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  late final StorageAppExample _storage;

  @override
  void initState() {
    super.initState();
    _storage = StorageAppExample.instance;
    _initializeAndCheckFirstLaunch();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
  }

  Future<void> _initializeAndCheckFirstLaunch() async {
    // Initialize storage first
    await _storage.initAppStorage();

    // Check first launch synchronously (now available after init)
    if (!_storage.isFirstLaunch() && mounted) {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Note: ThemeDimensions doesn't need refresh as it uses static constants
    ThemeData theme = Theme.of(context);
    final settingsController = context.watch<SettingsControllerAppExample>();
    bool isDarkMode = settingsController.themeMode == ThemeMode.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              CommonAssetsImages.placeholder,
              fit: BoxFit.cover,
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(flex: 2),
                  // App name and slogans
                  Text(
                    'app_name'.tr(context),
                    style: theme.textTheme.displayLarge?.copyWith(
                      fontSize: 48,
                      fontWeight: FontWeight.w900,
                      color: isDarkMode
                          ? theme.colorScheme.primaryContainer
                          : theme.colorScheme.primary,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'slogan_words'.tr(context),
                    style: theme.textTheme.displayMedium?.copyWith(
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: isDarkMode
                          ? theme.colorScheme.secondaryContainer
                          : theme.colorScheme.secondary,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'slogan_eyes'.tr(context),
                    style: theme.textTheme.displayMedium?.copyWith(
                      fontSize: 24,
                      fontWeight: FontWeight.w500,
                      color: isDarkMode
                          ? theme.colorScheme.tertiaryContainer
                          : theme.colorScheme.tertiary,
                      height: 1.1,
                    ),
                  ),
                  const Spacer(),
                  // Start Button
                  CustomButton(
                    buttonText: 'lets_start'.tr(context),
                    onPressed: () async {
                      _storage.setNotFirstLaunch();
                      if (mounted) {
                        context.go('/home');
                      }
                    },
                  ),
                  const SizedBox(height: 24),
                  // Bottom sign up text
                  Center(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'do_not_have_account'.tr(context),
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: isDarkMode
                                ? theme.colorScheme.onSurface.withOpacity(0.7)
                                : theme.colorScheme.onSurface
                                    .withOpacity(0.7),
                            fontSize: 14,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            context.go('/signup');
                          },
                          style: TextButton.styleFrom(
                            minimumSize: Size.zero,
                            padding: const EdgeInsets.only(left: 4),
                          ),
                          child: Text(
                            'signup_for_free'.tr(context),
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: theme.colorScheme.primary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
