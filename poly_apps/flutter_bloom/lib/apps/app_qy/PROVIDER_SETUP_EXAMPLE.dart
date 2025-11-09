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

/// Provider Setup Example for QY App
/// This file demonstrates how to configure all providers
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// Services
import 'services_app_qy/api_service_app_qy.dart';
import 'features_app_qy/home/domain/service/learning_service.dart';
import 'features_app_qy/word/domain/service/word_service.dart';
import 'features_app_qy/course/domain/service/course_service.dart';

// Controllers
import 'features_app_qy/home/controllers/learning_controller_app_qy.dart';
import 'features_app_qy/word/controllers/word_controller_app_qy.dart';

// Models
import 'models_app_qy/user_model_app_qy.dart';

/// Example of how to set up all providers for QY App
///
/// Usage in main.dart or app entry point:
///
/// ```dart
/// void main() {
///   runApp(
///     QyAppProviders(
///       child: MyApp(),
///     ),
///   );
/// }
/// ```
class QyAppProviders extends StatelessWidget {
  final Widget child;

  const QyAppProviders({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    // Create singleton instances
    final apiService = ApiServiceAppQy();

    // Create service instances
    final learningService = LearningService(apiService: apiService);
    final wordService = WordService(apiService: apiService);
    final courseService = CourseService(apiService: apiService);

    return MultiProvider(
      providers: [
        // User Model Provider
        ChangeNotifierProvider<UserModelAppQy>(
          create: (_) => UserModelAppQy.empty(),
        ),

        // Home/Learning Module
        ChangeNotifierProvider<LearningControllerAppQy>(
          create: (_) => LearningControllerAppQy(
            learningService: learningService,
          ),
        ),

        // Word Module
        ChangeNotifierProvider<WordControllerAppQy>(
          create: (_) => WordControllerAppQy(
            wordService: wordService,
          ),
        ),

        // Course Module (when controller is created)
        // ChangeNotifierProvider<CourseControllerAppQy>(
        //   create: (_) => CourseControllerAppQy(
        //     courseService: courseService,
        //   ),
        // ),

        // Settings Module (when created)
        // ChangeNotifierProvider<SettingsControllerAppQy>(
        //   create: (_) => SettingsControllerAppQy(
        //     settingsService: settingsService,
        //   ),
        // ),

        // Profile Module (when created)
        // ChangeNotifierProvider<ProfileControllerAppQy>(
        //   create: (_) => ProfileControllerAppQy(
        //     profileService: profileService,
        //   ),
        // ),

        // Social Module (when created)
        // ChangeNotifierProvider<SocialControllerAppQy>(
        //   create: (_) => SocialControllerAppQy(
        //     socialService: socialService,
        //   ),
        // ),
      ],
      child: child,
    );
  }
}

/// Alternative: Lazy Provider Setup
///
/// If you prefer lazy initialization:
///
/// ```dart
/// MultiProvider(
///   providers: [
///     ChangeNotifierProxyProvider0<LearningControllerAppQy>(
///       create: (_) => LearningControllerAppQy(
///         learningService: LearningService(
///           apiService: ApiServiceAppQy(),
///         ),
///       ),
///       lazy: true,
///     ),
///     // ... other providers
///   ],
///   child: child,
/// )
/// ```

/// Example of using providers in widgets:
///
/// ```dart
/// // Read once (doesn't rebuild)
/// final controller = context.read<LearningControllerAppQy>();
/// controller.loadLearningStats();
///
/// // Watch (rebuilds on change)
/// final stats = context.watch<LearningControllerAppQy>().learningStats;
///
/// // Consumer (rebuilds only this widget)
/// Consumer<LearningControllerAppQy>(
///   builder: (context, controller, child) {
///     return Text(controller.learningStats.totalWords.toString());
///   },
/// )
/// ```

/// Best Practices:
///
/// 1. Create services as singletons
/// 2. Pass services to controllers via constructor
/// 3. Use ChangeNotifierProvider for controllers
/// 4. Use Provider for immutable models
/// 5. Use Consumer for selective rebuilds
/// 6. Use context.read for one-time operations
/// 7. Use context.watch for reactive updates
/// 8. Always dispose controllers properly
