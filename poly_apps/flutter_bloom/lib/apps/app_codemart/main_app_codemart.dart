import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'router_app_codemart/router_app_codemart.dart';
import 'localization_app_codemart/en_app_codemart.dart';
import 'localization_app_codemart/zh_app_codemart.dart';
import 'models_app_codemart/user_model_app_codemart.dart';
import 'models_app_codemart/app_data_center_app_codemart.dart';
import 'resources_app_codemart/theme_app_codemart.dart';

void main() {
  runCodemartApp();
}

Future<void> runCodemartApp() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize AppDataCenter (singleton)
  final appDataCenter = AppDataCenterAppCodemart();
  final router = RouterAppCodemart.createRouter();

  runCommonApp(
    routerConfig: router,
    enAppLocales: [enAppCodemart],
    zhAppLocales: [zhAppCodemart],
    appName: 'CodeMart',
    appId: 'codemart',
    lightTheme: CodemartTheme.light(),
    darkTheme: CodemartTheme.dark(),
    additionalProviders: [
      // Provide AppDataCenter (unified data center)
      ChangeNotifierProvider<AppDataCenterAppCodemart>.value(value: appDataCenter),
      // Provide UserModel through AppDataCenter
      ChangeNotifierProvider<UserModelAppCodemart>.value(value: appDataCenter.userModel),
    ],
  );
}
