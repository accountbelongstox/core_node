import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'config_app_codemart/api_config_app_codemart.dart';
import 'localization_app_codemart/en_app_codemart.dart';
import 'localization_app_codemart/zh_app_codemart.dart';
import 'models_app_codemart/user_model_app_codemart.dart';
import 'router_app_codemart/router_app_codemart.dart';
import 'services_app_codemart/auth_api_service_app_codemart.dart';
import 'services_app_codemart/user_api_service_app_codemart.dart';
import 'services_app_codemart/project_api_service_app_codemart.dart';
import 'services_app_codemart/task_api_service_app_codemart.dart';

void main() {
  runApp(const CodeMartApp());
}

class CodeMartApp extends StatelessWidget {
  const CodeMartApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Get namespace from environment or use default
    const namespace = String.fromEnvironment(
      'CODEMART_NAMESPACE',
      defaultValue: 'codemart_default',
    );

    return MultiProvider(
      providers: [
        // User state management
        ChangeNotifierProvider(
          create: (_) => UserModelAppCodemart(),
        ),

        // API services
        Provider(
          create: (_) => AuthApiServiceAppCodemart(
            baseUrl: ApiConfigAppCodemart.baseUrl,
            namespace: namespace,
          ),
        ),
        Provider(
          create: (_) => UserApiServiceAppCodemart(
            baseUrl: ApiConfigAppCodemart.baseUrl,
            namespace: namespace,
          ),
        ),
        Provider(
          create: (_) => ProjectApiServiceAppCodemart(
            baseUrl: ApiConfigAppCodemart.baseUrl,
            namespace: namespace,
          ),
        ),
        Provider(
          create: (_) => TaskApiServiceAppCodemart(
            baseUrl: ApiConfigAppCodemart.baseUrl,
            namespace: namespace,
          ),
        ),
      ],
      child: Builder(
        builder: (context) {
          final router = RouterAppCodemart.createRouter();

          return MaterialApp.router(
            title: 'CodeMart',
            debugShowCheckedModeBanner: false,

            // Router configuration
            routerConfig: router,

            // Theme configuration (can be moved to theme_app_codemart.dart later)
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(
                seedColor: const Color(0xFF2563EB), // Blue
                brightness: Brightness.light,
              ),
              useMaterial3: true,
              appBarTheme: const AppBarTheme(
                centerTitle: true,
                elevation: 0,
              ),
              cardTheme: CardTheme(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              inputDecorationTheme: InputDecorationTheme(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                filled: true,
              ),
            ),

            darkTheme: ThemeData(
              colorScheme: ColorScheme.fromSeed(
                seedColor: const Color(0xFF2563EB), // Blue
                brightness: Brightness.dark,
              ),
              useMaterial3: true,
              appBarTheme: const AppBarTheme(
                centerTitle: true,
                elevation: 0,
              ),
              cardTheme: CardTheme(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              inputDecorationTheme: InputDecorationTheme(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                filled: true,
              ),
            ),

            themeMode: ThemeMode.system,

            // Localization configuration
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('en', 'US'), // English
              Locale('zh', 'CN'), // Chinese
            ],

            // Locale resolution
            localeResolutionCallback: (locale, supportedLocales) {
              if (locale != null) {
                for (var supportedLocale in supportedLocales) {
                  if (supportedLocale.languageCode == locale.languageCode) {
                    return supportedLocale;
                  }
                }
              }
              return supportedLocales.first;
            },
          );
        },
      ),
    );
  }
}

// Localization helper class
class AppLocalizationsCodemart {
  final Locale locale;
  late Map<String, String> _localizedStrings;

  AppLocalizationsCodemart(this.locale);

  static AppLocalizationsCodemart of(BuildContext context) {
    return Localizations.of<AppLocalizationsCodemart>(
      context,
      AppLocalizationsCodemart,
    )!;
  }

  static const LocalizationsDelegate<AppLocalizationsCodemart> delegate =
      _AppLocalizationsCodemartDelegate();

  Future<bool> load() async {
    if (locale.languageCode == 'zh') {
      _localizedStrings = zhAppCodemart;
    } else {
      _localizedStrings = enAppCodemart;
    }
    return true;
  }

  String translate(String key) {
    return _localizedStrings[key] ?? key;
  }

  // Shorthand method
  String tr(String key) => translate(key);
}

class _AppLocalizationsCodemartDelegate
    extends LocalizationsDelegate<AppLocalizationsCodemart> {
  const _AppLocalizationsCodemartDelegate();

  @override
  bool isSupported(Locale locale) {
    return ['en', 'zh'].contains(locale.languageCode);
  }

  @override
  Future<AppLocalizationsCodemart> load(Locale locale) async {
    AppLocalizationsCodemart localizations = AppLocalizationsCodemart(locale);
    await localizations.load();
    return localizations;
  }

  @override
  bool shouldReload(_AppLocalizationsCodemartDelegate old) => false;
}

// Extension for easy access to translations
extension LocalizationExtension on BuildContext {
  AppLocalizationsCodemart get loc => AppLocalizationsCodemart.of(this);

  String tr(String key) => AppLocalizationsCodemart.of(this).tr(key);
}
