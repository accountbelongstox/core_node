import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/settings_controller_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';
import 'package:provider/provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  late final StorageAppQy _storage;

  @override
  void initState() {
    super.initState();
    _storage = StorageAppQy.instance;
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
      context.go(QyAppRoutesProvider.routeHome);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Note: ThemeDimensions doesn't need refresh as it uses static constants
    ThemeData theme = Theme.of(context);
    final settingsController = context.watch<SettingsControllerAppQy>();
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
              padding:
                  EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(flex: 2),
                  // App name and slogans
                  Text(
                    QyAppLocalizationKeys.qyAppName.tr(context),
                    style: ThemeTextStyles.largeTitleBold.copyWith(
                      fontSize: ThemeTextStyles.largeTitleBold.fontSize! * 1.4,
                      fontWeight: FontWeight.w900,
                      color: isDarkMode
                          ? theme.colorScheme.primaryContainer
                          : theme.colorScheme.primary,
                      height: 1.1,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacingMedium),
                  Text(
                    QyAppLocalizationKeys.qySloganWords.tr(context),
                    style: ThemeTextStyles.title1Bold.copyWith(
                      fontSize: ThemeTextStyles.title1Bold.fontSize! * 1.15,
                      fontWeight: FontWeight.w700,
                      color: isDarkMode
                          ? theme.colorScheme.secondaryContainer
                          : theme.colorScheme.secondary,
                      height: 1.1,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacingSmall),
                  Text(
                    QyAppLocalizationKeys.qySloganEyes.tr(context),
                    style: ThemeTextStyles.title2.copyWith(
                      fontSize: ThemeTextStyles.title2.fontSize! * 1.1,
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
                    buttonText: QyAppLocalizationKeys.qyLetsStart.tr(context),
                    onPressed: () async {
                      _storage.setNotFirstLaunch();
                      if (mounted) {
                        context.go(QyAppRoutesProvider.routeHome);
                      }
                    },
                  ),
                  SizedBox(height: ThemeDimensions.spacingLarge),
                  // Bottom sign up text
                  Center(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          QyAppLocalizationKeys.qyDoNotHaveAccount.tr(context),
                          style: ThemeTextStyles.body2.copyWith(
                            color: isDarkMode
                                ? theme.colorScheme.onSurface.withOpacity(0.7)
                                : theme.colorScheme.onSurface.withOpacity(0.7),
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            // TODO: Implement signup route
                            // context.go(QyAppRoutesProvider.routeSignup);
                          },
                          style: TextButton.styleFrom(
                            minimumSize: Size.zero,
                            padding:
                                EdgeInsets.only(left: ThemeDimensions.spacing4),
                          ),
                          child: Text(
                            QyAppLocalizationKeys.qySignupForFree.tr(context),
                            style: ThemeTextStyles.body2.copyWith(
                              color: theme.colorScheme.primary,
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
