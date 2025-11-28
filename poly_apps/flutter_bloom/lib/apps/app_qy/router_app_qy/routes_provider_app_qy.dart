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

import 'package:go_router/go_router.dart';

// Import QY App Screens (MVC Architecture)
// Authentication
import '../features_app_qy/auth/views/login_screen_refactored_app_qy.dart';
// Home
import '../features_app_qy/home/views/home_study_screen_refactored_app_qy.dart';
import '../features_app_qy/home/views/home_search_screen_app_qy.dart';
// Course
import '../features_app_qy/course/views/course_ielts_screen_app_qy.dart';
import '../features_app_qy/course/views/course_plans_screen_app_qy.dart';
import '../features_app_qy/course/views/course_detail_screen_app_qy.dart';
import '../features_app_qy/course/views/course_lesson_screen_app_qy.dart';
import '../features_app_qy/course/views/course_progress_screen_app_qy.dart';
import '../features_app_qy/course/views/course_review_screen_app_qy.dart';
import '../features_app_qy/course/views/course_search_screen_app_qy.dart';
import '../features_app_qy/course/views/course_certificate_screen_app_qy.dart';
// Word
import '../features_app_qy/word/views/word_book_screen_app_qy.dart';
import '../features_app_qy/word/views/word_listening_screen_app_qy.dart';
import '../features_app_qy/word/views/word_dictation_screen_app_qy.dart';
import '../features_app_qy/word/views/word_flashcard_screen_app_qy.dart';
import '../features_app_qy/word/views/word_review_screen_app_qy.dart';
import '../features_app_qy/word/views/word_listening_1_screen_app_qy.dart';
import '../features_app_qy/word/views/word_listening_dictation_1_screen_app_qy.dart';
import '../features_app_qy/word/views/word_listening_dictation_2_screen_app_qy.dart';
import '../features_app_qy/word/views/word_listening_free_screen_app_qy.dart';
import '../features_app_qy/word/views/word_listening_sleep_screen_app_qy.dart';
// Profile
import '../features_app_qy/profile/views/about_screen_app_qy.dart';
import '../features_app_qy/profile/views/certificate_center_screen_app_qy.dart';
import '../features_app_qy/profile/views/more_features_screen_app_qy.dart';
import '../features_app_qy/profile/views/profile_achievements_screen_app_qy.dart';
// Settings
import '../features_app_qy/settings/views/settings_screen_v2_refactored_app_qy.dart';
import '../features_app_qy/settings/views/account_settings_screen_app_qy.dart';
import '../features_app_qy/settings/views/display_mode_screen_app_qy.dart';
import '../features_app_qy/settings/views/help_center_screen_app_qy.dart';
import '../features_app_qy/settings/views/recommend_settings_screen_app_qy.dart';
import '../features_app_qy/settings/views/reminder_settings_screen_app_qy.dart';
// Social
import '../features_app_qy/social/views/checkin_challenge_screen_app_qy.dart';
import '../features_app_qy/social/views/message_center_screen_app_qy.dart';
// AI Study
import '../features_app_qy/ai_study/views/ai_study_screen_app_qy.dart';
// Discover
import '../features_app_qy/discover/views/discover_screen_app_qy.dart';
// Other
import '../features_app_qy/other/views/image_001_screen_app_qy.dart';

// [DEPRECATED - MS] Old screens - Not used in refactored routes
// import '../features_app_qy/splash/views/splash_screen.dart';
// import '../features_app_qy/dashboard/views/dashboard_screen.dart';
// import '../features_app_qy/onbording/views/onbording_screen.dart';
// import '../features_app_qy/authentication/views/signin_up_screen.dart';
// import '../features_app_qy/authentication/views/forgot_screen.dart';
// import '../features_app_qy/authentication/views/verify_screen.dart';
// import '../features_app_qy/authentication/views/resetpassword_screen.dart';
// import '../features_app_qy/authentication/views/congratulation_screen.dart';
// import '../features_app_qy/profile/views/edit_profile.dart';
// import '../features_app_qy/inbox/views/chat_screen.dart';
// import '../features_app_qy/about/about_screen.dart';
// import '../features_app_qy/setting/views/setting_screen_view.dart';
// import '../features_app_qy/setting/views/help_screen.dart';
// import '../features_app_qy/setting/views/notification_setting.dart';
// import '../features_app_qy/setting/views/security_screen.dart';
// import '../features_app_qy/bookmark/bookmark_screen.dart';
// import '../features_app_qy/search/search_screen.dart';

/// QY App Routes Provider
/// Provides routes for the QY app following the dual-entry architecture
/// Route keys are defined directly in this file to avoid separate constant files
class QyAppRoutesProvider {
  // Route constants with /qy namespace
  static const String routeHome = '/qy/home';
  static const String routeLogin = '/qy/login';

  // Home routes
  static const String routeHomeSearch = '/qy/home/search';

  // Course routes
  static const String routeCourseIelts = '/qy/course/ielts';
  static const String routeCoursePlans = '/qy/course/plans';
  static const String routeCourseDetail = '/qy/course/detail';
  static const String routeCourseLesson = '/qy/course/lesson';
  static const String routeCourseProgress = '/qy/course/progress';
  static const String routeCourseReview = '/qy/course/review';
  static const String routeCourseSearch = '/qy/course/search';
  static const String routeCourseCertificate = '/qy/course/certificate';

  // Word routes
  static const String routeWordBook = '/qy/word/book';
  static const String routeWordListening = '/qy/word/listening';
  static const String routeWordDictation = '/qy/word/dictation';
  static const String routeWordFlashcard = '/qy/word/flashcard';
  static const String routeWordReview = '/qy/word/review';
  static const String routeWordListening1 = '/qy/word/listening-1';
  static const String routeWordListeningDictation1 =
      '/qy/word/listening-dictation-1';
  static const String routeWordListeningDictation2 =
      '/qy/word/listening-dictation-2';
  static const String routeWordListeningFree = '/qy/word/listening-free';
  static const String routeWordListeningSleep = '/qy/word/listening-sleep';

  // Profile routes
  static const String routeAbout = '/qy/profile/about';
  static const String routeCertificateCenter = '/qy/profile/certificate-center';
  static const String routeMoreFeatures = '/qy/profile/more-features';
  static const String routeProfileAchievements = '/qy/profile/achievements';

  // Settings routes
  static const String routeSettings = '/qy/settings';
  static const String routeAccountSettings = '/qy/settings/account';
  static const String routeDisplayMode = '/qy/settings/display-mode';
  static const String routeHelpCenter = '/qy/settings/help-center';
  static const String routeRecommendSettings = '/qy/settings/recommend';
  static const String routeReminderSettings = '/qy/settings/reminder';

  // Social routes
  static const String routeCheckinChallenge = '/qy/social/checkin-challenge';
  static const String routeMessageCenter = '/qy/social/message-center';

  // AI Study routes
  static const String routeAiStudy = '/qy/ai-study';

  // Discover routes
  static const String routeDiscover = '/qy/discover';

  // Other routes
  static const String routeImage001 = '/qy/other/image-001';

  // [DEPRECATED - MS] Old routes - Not used in refactored app
  // static const String routeSplash = '/qy/splash';
  // static const String routeInitial = '/qy/initial';
  // static const String routeOnboarding = '/qy/onboarding';
  // static const String routeSignup = '/qy/signup';
  // static const String routeForgot = '/qy/forgot';
  // static const String routeVerify = '/qy/verify';
  // static const String routeReset = '/qy/reset';
  // static const String routeCongratulations = '/qy/congratulations';
  // static const String routeProfile = '/qy/profile';
  // static const String routeEditProfile = '/qy/edit-profile';
  // static const String routeChat = '/qy/chat';
  // static const String routeHelp = '/qy/help';
  // static const String routeNotifications = '/qy/notifications';
  // static const String routeSecurity = '/qy/security';
  // static const String routeBookmarks = '/qy/bookmarks';
  // static const String routeSearch = '/qy/search';
  // static const String routeDashboard = '/qy/dashboard';
  // static const String routeUrgentFundraising = '/qy/urgent-fundraising';
  // static const String routeComingEnd = '/qy/coming-end';
  // static const String routeWatchImpact = '/qy/watch-impact';
  // static const String routePrayer = '/qy/prayer';
  // static const String routeDonation = '/qy/donation';
  // static const String routeAlldonation = '/qy/all-donation';
  // static const String routeFundraising = '/qy/fundraising';

  /// Create GoRouter configuration for QY app
  static GoRouter createRouter({String? initialLocation}) {
    final String effectiveInitialLocation = initialLocation ?? routeHome;
    return GoRouter(
      initialLocation: effectiveInitialLocation,
      routes: getQyAppRoutes(),
    );
  }

  // Route getter methods for external access
  static String getHomeRoute() => routeHome;
  static String getLoginRoute() => routeLogin;
  static String getHomeSearchRoute() => routeHomeSearch;
  static String getCourseIeltsRoute() => routeCourseIelts;
  static String getCoursePlansRoute() => routeCoursePlans;
  static String getCourseDetailRoute() => routeCourseDetail;
  static String getCourseLessonRoute() => routeCourseLesson;
  static String getCourseProgressRoute() => routeCourseProgress;
  static String getCourseReviewRoute() => routeCourseReview;
  static String getCourseSearchRoute() => routeCourseSearch;
  static String getCourseCertificateRoute() => routeCourseCertificate;
  static String getWordBookRoute() => routeWordBook;
  static String getWordListeningRoute() => routeWordListening;
  static String getWordDictationRoute() => routeWordDictation;
  static String getWordFlashcardRoute() => routeWordFlashcard;
  static String getWordReviewRoute() => routeWordReview;
  static String getWordListening1Route() => routeWordListening1;
  static String getWordListeningDictation1Route() =>
      routeWordListeningDictation1;
  static String getWordListeningDictation2Route() =>
      routeWordListeningDictation2;
  static String getWordListeningFreeRoute() => routeWordListeningFree;
  static String getWordListeningSleepRoute() => routeWordListeningSleep;
  static String getAboutRoute() => routeAbout;
  static String getCertificateCenterRoute() => routeCertificateCenter;
  static String getMoreFeaturesRoute() => routeMoreFeatures;
  static String getProfileAchievementsRoute() => routeProfileAchievements;
  static String getSettingsRoute() => routeSettings;
  static String getAccountSettingsRoute() => routeAccountSettings;
  static String getDisplayModeRoute() => routeDisplayMode;
  static String getHelpCenterRoute() => routeHelpCenter;
  static String getRecommendSettingsRoute() => routeRecommendSettings;
  static String getReminderSettingsRoute() => routeReminderSettings;
  static String getCheckinChallengeRoute() => routeCheckinChallenge;
  static String getMessageCenterRoute() => routeMessageCenter;
  static String getAiStudyRoute() => routeAiStudy;
  static String getDiscoverRoute() => routeDiscover;
  static String getImage001Route() => routeImage001;

  /// Get default route for the QY app
  static String getDefaultRoute() => routeHome;

  /// Get all QY app routes
  static List<RouteBase> getQyAppRoutes() {
    return [
      // Home routes (Entry point)
      GoRoute(
        path: routeHome,
        name: 'qy_home',
        builder: (context, state) => const HomeStudyScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeHomeSearch,
        name: 'qy_home_search',
        builder: (context, state) => const HomeSearchScreenRefactoredAppQy(),
      ),

      // Authentication routes
      GoRoute(
        path: routeLogin,
        name: 'qy_login',
        builder: (context, state) => const LoginScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: '/login',
        redirect: (context, state) => routeLogin,
      ),

      // Course routes
      GoRoute(
        path: routeCourseIelts,
        name: 'qy_course_ielts',
        builder: (context, state) => const CourseIeltsScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeCoursePlans,
        name: 'qy_course_plans',
        builder: (context, state) => const CoursePlansScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeCourseDetail,
        name: 'qy_course_detail',
        builder: (context, state) => const CourseDetailScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeCourseLesson,
        name: 'qy_course_lesson',
        builder: (context, state) => CourseLessonScreenRefactoredAppQy(
          lessonId: state.uri.queryParameters['lessonId'] ?? '1',
        ),
      ),
      GoRoute(
        path: routeCourseProgress,
        name: 'qy_course_progress',
        builder: (context, state) => CourseProgressScreenRefactoredAppQy(
          courseId: state.uri.queryParameters['courseId'] ?? '1',
        ),
      ),
      GoRoute(
        path: routeCourseReview,
        name: 'qy_course_review',
        builder: (context, state) => CourseReviewScreenRefactoredAppQy(
          courseId: state.uri.queryParameters['courseId'] ?? '1',
        ),
      ),
      GoRoute(
        path: routeCourseSearch,
        name: 'qy_course_search',
        builder: (context, state) => const CourseSearchScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeCourseCertificate,
        name: 'qy_course_certificate',
        builder: (context, state) => CourseCertificateScreenRefactoredAppQy(
          courseId: state.uri.queryParameters['courseId'] ?? '1',
        ),
      ),

      // Word routes
      GoRoute(
        path: routeWordBook,
        name: 'qy_word_book',
        builder: (context, state) => const WordBookScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordListening,
        name: 'qy_word_listening',
        builder: (context, state) => const WordListeningScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordDictation,
        name: 'qy_word_dictation',
        builder: (context, state) => const WordDictationScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordFlashcard,
        name: 'qy_word_flashcard',
        builder: (context, state) => const WordFlashcardScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordReview,
        name: 'qy_word_review',
        builder: (context, state) => const WordReviewScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordListening1,
        name: 'qy_word_listening_1',
        builder: (context, state) =>
            const WordListening1ScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordListeningDictation1,
        name: 'qy_word_listening_dictation_1',
        builder: (context, state) =>
            const WordListeningDictation1ScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordListeningDictation2,
        name: 'qy_word_listening_dictation_2',
        builder: (context, state) =>
            const WordListeningDictation2ScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordListeningFree,
        name: 'qy_word_listening_free',
        builder: (context, state) =>
            const WordListeningFreeScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeWordListeningSleep,
        name: 'qy_word_listening_sleep',
        builder: (context, state) =>
            const WordListeningSleepScreenRefactoredAppQy(),
      ),

      // Profile routes
      GoRoute(
        path: routeAbout,
        name: 'qy_about',
        builder: (context, state) => const AboutScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeCertificateCenter,
        name: 'qy_certificate_center',
        builder: (context, state) =>
            const CertificateCenterScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeMoreFeatures,
        name: 'qy_more_features',
        builder: (context, state) => const MoreFeaturesScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeProfileAchievements,
        name: 'qy_profile_achievements',
        builder: (context, state) =>
            const ProfileAchievementsScreenRefactoredAppQy(),
      ),

      // Settings routes
      GoRoute(
        path: routeSettings,
        name: 'qy_settings',
        builder: (context, state) => const SettingsScreenV2RefactoredAppQy(),
      ),
      GoRoute(
        path: routeAccountSettings,
        name: 'qy_account_settings',
        builder: (context, state) =>
            const AccountSettingsScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeDisplayMode,
        name: 'qy_display_mode',
        builder: (context, state) => const DisplayModeScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeHelpCenter,
        name: 'qy_help_center',
        builder: (context, state) => const HelpCenterScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeRecommendSettings,
        name: 'qy_recommend_settings',
        builder: (context, state) =>
            const RecommendSettingsScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeReminderSettings,
        name: 'qy_reminder_settings',
        builder: (context, state) =>
            const ReminderSettingsScreenRefactoredAppQy(),
      ),

      // Social routes
      GoRoute(
        path: routeCheckinChallenge,
        name: 'qy_checkin_challenge',
        builder: (context, state) =>
            const CheckinChallengeScreenRefactoredAppQy(),
      ),
      GoRoute(
        path: routeMessageCenter,
        name: 'qy_message_center',
        builder: (context, state) => const MessageCenterScreenRefactoredAppQy(),
      ),

      // AI Study routes
      GoRoute(
        path: routeAiStudy,
        name: 'qy_ai_study',
        builder: (context, state) => const AiStudyScreenRefactoredAppQy(),
      ),

      // Discover routes
      GoRoute(
        path: routeDiscover,
        name: 'qy_discover',
        builder: (context, state) => const DiscoverScreenRefactoredAppQy(),
      ),

      // Other routes
      GoRoute(
        path: routeImage001,
        name: 'qy_image_001',
        builder: (context, state) => const Image001ScreenRefactoredAppQy(),
      ),
    ];
  }

  /// Get route information for debugging
  static Map<String, dynamic> getRouteInfo() {
    final routes = getQyAppRoutes();
    return {
      'appId': 'qy',
      'routePrefix': '/qy',
      'totalRoutes': routes.length,
      'defaultRoute': getDefaultRoute(),
      'availableRoutes': routes.map((route) {
        if (route is GoRoute) {
          return {
            'path': route.path,
            'name': route.name,
          };
        }
        return {'type': route.runtimeType.toString()};
      }).toList(),
    };
  }

  /// Check if a route path belongs to QY app
  static bool isQyRoute(String path) {
    return path.startsWith('/qy/');
  }

  /// Get route name from path
  static String? getRouteNameFromPath(String path) {
    final routes = getQyAppRoutes();
    for (final route in routes) {
      if (route is GoRoute && route.path == path) {
        return route.name;
      }
    }
    return null;
  }

  /// Get all route paths
  static List<String> getAllRoutePaths() {
    final routes = getQyAppRoutes();
    return routes.whereType<GoRoute>().map((route) => route.path).toList();
  }

  /// Get all route names
  static List<String> getAllRouteNames() {
    final routes = getQyAppRoutes();
    return routes
        .whereType<GoRoute>()
        .map((route) => route.name)
        .where((name) => name != null)
        .cast<String>()
        .toList();
  }
}
