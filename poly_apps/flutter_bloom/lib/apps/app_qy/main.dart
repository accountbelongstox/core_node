/// Main entry point for app_qy
/// Shanbay vocabulary learning app with centralized systems
library main_app_qy;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../common/i18n/i18n_service.dart';
import '../../../../common/theme/app_theme.dart';
import '../../../../common/services/settings_service.dart';
import 'features_app_qy/authentication/views/login_screen_v2_app_qy.dart';
import 'provider_app_qy/user_provider_app_qy.dart';
import 'features_app_qy/authentication/auth_routes_app_qy.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize services
  await SettingsService().initialize();

  runApp(const AppQy());
}

class AppQy extends StatelessWidget {
  const AppQy({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: I18nService()),
        ChangeNotifierProvider.value(value: SettingsService()),
        ChangeNotifierProvider(create: (_) => UserProviderAppQy()),
      ],
      child: Consumer2<I18nService, SettingsService>(
        builder: (context, i18n, settings, child) {
          return MaterialApp(
            title: 'app.name'.tr,
            debugShowCheckedModeBanner: false,
            locale: i18n.currentLocale,
            supportedLocales: i18n.supportedLocales,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: settings.themeMode,
            home: const LoginScreenV2AppQy(),
            routes: AuthRoutesAppQy.getRoutes(),
            onGenerateRoute: (settings) {
              // Handle additional routes if needed
              return null;
            },
          );
        },
      ),
    );
  }
}

/// Extension for easy translation access
extension I18nString on String {
  String get tr => I18nService().translate(this);
  String trParams(Map<String, dynamic> params) =>
      I18nService().translate(this, params: params);
}