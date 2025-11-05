import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/en_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/zh_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/controller_app_vipclub/settings_controller_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/controller_app_vipclub/splash_controller_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_auth_api_service.dart';
import 'package:qyflutter/apps/app_vipclub/provider_app_vipclub/user_provider_app_vipclub.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  runCommonApp(
    appName: 'VIP Club',
    routerConfig: createVipClubRouter(),
    enAppLocales: [enAppVipClub],
    zhAppLocales: [zhAppVipClub],
    additionalProviders: [
      ChangeNotifierProvider(create: (_) => VipClubSettingsController()),
      ChangeNotifierProvider(create: (_) => VipClubSplashController()),
      ChangeNotifierProvider(create: (_) => VipClubUserProvider()),
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
    ],
  );
}
