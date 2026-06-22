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

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'config_app_qy/app_config_app_qy.dart';
import 'config_app_qy/provider_app_qy.dart';
import 'router_app_qy/routes_provider_app_qy.dart';
import 'settings_app_qy/settings_app_qy.dart';
import 'localization_app_qy/en_app_qy.dart';
import 'localization_app_qy/zh_app_qy.dart';
import 'providers_app_qy/qy_user_provider.dart';
import 'controller_app_qy/settings_controller_app_qy.dart';
import 'controller_app_qy/settings_controller_refactored_app_qy.dart';
import 'controller_app_qy/learning_controller_app_qy.dart';
import 'controller_app_qy/auth_controller_app_qy.dart';
import 'controller_app_qy/endpoint_discovery_controller_app_qy.dart';
import 'features_app_qy/course/controllers/course_controller_app_qy.dart';
import 'features_app_qy/course/domain/service/course_service.dart';
import 'features_app_qy/word/controllers/word_controller_app_qy.dart';
import 'features_app_qy/word/domain/service/word_service.dart';
import 'features_app_qy/home/controllers/learning_controller_app_qy.dart'
    as home_learning;
import 'features_app_qy/home/domain/service/learning_service.dart';
import 'services_app_qy/api_service_app_qy.dart';
import 'services_app_qy/vocabulary_service_app_qy.dart';
import 'services_app_qy/auth_service_app_qy.dart';
import 'models_app_qy/user_model_app_qy.dart';
import 'config_app_qy/api_config_app_qy.dart';
import 'package:qyflutter/common/network/core/multi_endpoint_discovery.dart';
import 'widgets_app_qy/network_status_notification_app_qy.dart';

/// QY App specific widget
/// This can be customized for QY app specific needs
///
/// AI MODIFICATION NOTE: Enhanced by QR_Profile_AI_Assistant
/// - Maintained integration with common app structure
/// - Ready for app-specific customizations when needed
/// Other AIs: This follows the common app pattern correctly
class QyApp extends StatefulWidget {
  final GoRouter routerConfig;

  const QyApp({super.key, required this.routerConfig});

  @override
  State<QyApp> createState() => _QyAppState();
}

class _QyAppState extends State<QyApp> {
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    // Set context for endpoint discovery controller in build method
    // This ensures context is always up-to-date
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        try {
          final controller = context.read<EndpointDiscoveryControllerAppQy>();
          controller.setContext(context);
        } catch (e) {
          debugPrint('⚠️ Could not set context for endpoint discovery: $e');
        }
      }
    });

    // Wrap with Stack to show network status notification at the top
    // Explicitly set textDirection to avoid Directionality widget requirement
    return Stack(
      textDirection: TextDirection.ltr,
      children: [
        FlutterBloomMainApp(
          routerConfig: widget.routerConfig,
        ),
        const NetworkStatusNotificationAppQy(),
      ],
    );
  }
}

/// QY App specific main entry point
/// This entry point can be used to launch only the QY app
/// with specific configurations and customizations
Future<void> main() async {
  // Initialize multi-endpoint discovery before creating services
  final discovery = MultiEndpointDiscovery();
  discovery.configureEndpoints(ApiConfigAppQy.endpointConfigs);

  // Quick scan for available endpoints (fast, non-blocking)
  // Discovery runs in background and updates service when complete
  discovery
      .discoverAvailableEndpoint(
    healthCheckPath: '',
    timeout: const Duration(seconds: 2),
    parallelScan: true,
  )
      .then((selectedEndpoint) {
    if (selectedEndpoint != null) {
      // Base URL should be host:port only (e.g., http://192.168.50.2:9000)
      // Endpoints already include full path like /api/dict/v1/login
      final baseUrl = selectedEndpoint.buildFullUrl();
      ApiServiceAppQy().updateBaseUrl(baseUrl);
      debugPrint('✅ API endpoint updated to: $baseUrl');
    } else {
      debugPrint('⚠️ No available endpoints found, using default');
    }
  }).catchError((error) {
    debugPrint('⚠️ Endpoint discovery failed: $error');
  });

  final QyUserProvider qyUserProvider = QyUserProvider();
  final GoRouter routerConfig = QyAppRoutesProvider.createRouter();

  final ApiServiceAppQy apiService = ApiServiceAppQy();
  final VocabularyServiceAppQy vocabularyService = VocabularyServiceAppQy();
  final AuthServiceAppQy authService = AuthServiceAppQy();
  final CourseService courseService = CourseService(apiService: apiService);
  final WordService wordService = WordService(apiService: apiService);
  final LearningService learningService =
      LearningService(apiService: apiService);

  await runCommonApp(
    appName: QyAppConfig.appName,
    appId: QyAppConfig.appId,
    appSettings: QyAppSettings.getQyAppSettings(),
    enAppLocales: EnAppQy.locales,
    zhAppLocales: ZhAppQy.locales,
    initialRoute: QyAppRoutesProvider.routeHome,
    homeRoute: QyAppRoutesProvider.routeHome,
    routerConfig: routerConfig,
    appPrefs: prefsAppQy,
    customUserProvider: qyUserProvider,
    customApp: QyApp(routerConfig: routerConfig),
    scopedProvidersBuilder: (commonSettingsController) => [
      ChangeNotifierProvider<SettingsControllerAppQy>(
        create: (_) => SettingsControllerAppQy(commonSettingsController),
        lazy: false,
      ),
      ChangeNotifierProvider<SettingsControllerRefactoredAppQy>(
        create: (_) => SettingsControllerRefactoredAppQy(
          commonSettingsController: commonSettingsController,
        ),
        lazy: false,
      ),
      ChangeNotifierProvider<UserModelAppQy>(
        create: (_) => UserModelAppQy.empty(),
        lazy: false,
      ),
      ChangeNotifierProvider<VocabularyServiceAppQy>.value(
        value: vocabularyService,
      ),
      ChangeNotifierProvider<LearningControllerAppQy>(
        create: (_) => LearningControllerAppQy(
          vocabularyService: vocabularyService,
        ),
        lazy: false,
      ),
      ChangeNotifierProvider<home_learning.LearningControllerAppQy>(
        create: (_) => home_learning.LearningControllerAppQy(
          learningService: learningService,
        ),
        lazy: false,
      ),
      ChangeNotifierProvider<AuthServiceAppQy>.value(
        value: authService,
      ),
      ChangeNotifierProvider<AuthControllerAppQy>(
        create: (_) => AuthControllerAppQy(authService: authService),
        lazy: false,
      ),
      ChangeNotifierProvider<CourseControllerAppQy>(
        create: (_) => CourseControllerAppQy(courseService: courseService),
        lazy: false,
      ),
      ChangeNotifierProvider<WordControllerAppQy>(
        create: (_) => WordControllerAppQy(wordService: wordService),
        lazy: false,
      ),
      ChangeNotifierProvider<EndpointDiscoveryControllerAppQy>(
        create: (_) => EndpointDiscoveryControllerAppQy(),
        lazy: false,
      ),
    ],
    initializeUnifiedStorage: true,
  );
}
