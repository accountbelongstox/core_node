import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'config_app_bank/app_config_app_bank.dart';
import 'config_app_bank/provider_app_bank.dart';
import 'router_app_bank/router_app_bank.dart';
import 'settings_app_bank/settings_app_bank.dart';
import 'localization_app_bank/en_app_bank.dart';
import 'localization_app_bank/zh_app_bank.dart';
import 'helpers/bank_app_initializer.dart';



/// Bank App specific main entry point
/// This entry point launches only the Bank application
/// with banking-specific configurations and features
/// 
/// NOTE: We pass the Bank SharedPreferences class to runCommonApp
/// which will properly initialize it after Flutter binding is ready
Future<void> main() async {
  // CRITICAL: Initialize Flutter binding first before any operations that require it
  // This must be called before SharedPreferences or any other Flutter services
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize BankUserProvider before running the app
  await bankUserProvider.initialize();
  
  // Initialize Bank App (including license registration manager)
  await BankAppInitializer.instance.initialize();

  await runCommonApp(
    appName: BankAppConfig.appName,
    appId: BankAppConfig.appId, // Specific app ID for app-specific routing
    appSettings: BankAppSettings.getBankSettings(), // Bank specific settings
    enAppLocales: [EnAppBank.locales],
    zhAppLocales: [ZhAppBank.locales],
    initialRoute: BankAppRouter.routeDashboard,
    homeRoute: BankAppRouter.routeDashboard,
    appConfig: BankAppConfig.getConfig(),
    appPrefs: prefsAppBank, // Pass Bank SharedPreferences instance from provider
    routerConfig: BankAppRouter.createRouter(), // Pass the router configuration
    additionalProviders: [
      ChangeNotifierProvider.value(value: bankUserProvider),
    ],
    initializeUnifiedStorage: true, // Use v1 storage (UnifiedStorage + Hive)
  );
}