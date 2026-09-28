import 'package:flutter/material.dart';
import 'package:flutter_localization/flutter_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/localization/map_locales.dart';
import 'package:qyflutter/common/provider_status/screen_size_provider.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/en_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/zh_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/controller_app_vipclub/settings_controller_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/controller_app_vipclub/splash_controller_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/home/controllers/home_controller.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_auth_api_service.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_public_api_service.dart';
import 'package:qyflutter/apps/app_vipclub/provider_app_vipclub/user_provider_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/provider_app_vipclub/app_data_provider_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/theme_app_vipclub/vipclub_theme.dart';

class VipClubApp extends StatefulWidget {
  final GoRouter routerConfig;

  const VipClubApp({super.key, required this.routerConfig});

  @override
  State<VipClubApp> createState() => _VipClubAppState();
}

class _VipClubAppState extends State<VipClubApp> {
  final FlutterLocalization _localization = FlutterLocalization.instance;

  @override
  void initState() {
    super.initState();
    _localization.init(
      mapLocales: MapLocales.getMapLocales(),
      initLanguageCode: MapLocales.getDefaultLocale(),
    );
    _localization.onTranslatedLanguage = _onTranslatedLanguage;
  }

  void _onTranslatedLanguage(Locale? locale) {
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final SettingsController settingsController =
        context.watch<SettingsController>();
    final ScreenSizeProvider screenSizeProvider =
        context.watch<ScreenSizeProvider>();
    final String appName = "app_name".tr(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      screenSizeProvider.updateScreenSize(context);
    });

    return MaterialApp.router(
      title: appName,
      debugShowCheckedModeBanner: false,
      theme: VipClubTheme.light().copyWith(
        extensions: VipClubTheme.lightExtensions(),
      ),
      darkTheme: VipClubTheme.dark().copyWith(
        extensions: VipClubTheme.darkExtensions(),
      ),
      themeMode: settingsController.themeMode,
      supportedLocales: _localization.supportedLocales,
      localizationsDelegates: _localization.localizationsDelegates,
      routerConfig: widget.routerConfig,
    );
  }
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final GoRouter router = createVipClubRouter();

  runCommonApp(
    appName: 'VIP Club',
    routerConfig: router,
    enAppLocales: [enAppVipClub],
    zhAppLocales: [zhAppVipClub],
    customApp: VipClubApp(routerConfig: router),
    additionalProviders: [
      ChangeNotifierProvider(create: (_) => VipClubSettingsController()),
      ChangeNotifierProvider(create: (_) => VipClubSplashController()),
      ChangeNotifierProvider(create: (_) => VipClubUserProvider()),
      ChangeNotifierProvider(create: (_) => VipClubAppDataProvider()),
      ChangeNotifierProxyProvider<VipClubUserProvider, VipClubAuthController>(
        create: (context) => VipClubAuthController(
          VipClubAuthApiService(),
          context.read<VipClubUserProvider>(),
        ),
        update: (context, userProvider, authController) {
          if (authController == null) {
            return VipClubAuthController(
              VipClubAuthApiService(),
              userProvider,
            );
          }
          return authController;
        },
      ),
      ChangeNotifierProvider(
        create: (_) => VipClubHomeController(
          VipClubAuthApiService(),
          VipClubPublicApiService(),
        ),
      ),
    ],
  );
}
