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

// Import Example App feature screens
import '../features_app_example/splash/views/splash_screen.dart';
import '../features_app_example/dashboard/views/dashboard_screen.dart';
import '../features_app_example/onbording/views/onbording_screen.dart';
import '../features_app_example/authentication/views/signin_up_screen.dart';
import '../features_app_example/authentication/views/forgot_screen.dart';
import '../features_app_example/authentication/views/verify_screen.dart';
import '../features_app_example/authentication/views/resetpassword_screen.dart';
import '../features_app_example/authentication/views/congratulation_screen.dart';
import '../features_app_example/profile/views/edit_profile.dart';
import '../features_app_example/inbox/views/chat_screen.dart';
import '../features_app_example/about/about_screen.dart';
import '../features_app_example/setting/views/setting_screen_view.dart';
import '../features_app_example/setting/views/help_screen.dart';
import '../features_app_example/setting/views/notification_setting.dart';
import '../features_app_example/setting/views/security_screen.dart';
import '../features_app_example/bookmark/bookmark_screen.dart';
import '../features_app_example/search/search_screen.dart';

/// Example App Routes Provider
/// Provides routes for the Example app following the dual-entry architecture
/// Route keys are defined directly in this file to avoid separate constant files
class ExampleAppRoutesProvider {
  // Route constants with /example namespace
  static const String routeHome = '/example/home';
  static const String routeSplash = '/example/splash';
  static const String routeInitial = '/example/initial';
  static const String routeOnboarding = '/example/onboarding';
  static const String routeLogin = '/example/login';
  static const String routeSignup = '/example/signup';
  static const String routeForgot = '/example/forgot';
  static const String routeVerify = '/example/verify';
  static const String routeReset = '/example/reset';
  static const String routeCongratulations = '/example/congratulations';
  static const String routeProfile = '/example/profile';
  static const String routeEditProfile = '/example/edit-profile';
  static const String routeChat = '/example/chat';
  static const String routeAbout = '/example/about';
  static const String routeSettings = '/example/settings';
  static const String routeHelp = '/example/help';
  static const String routeNotifications = '/example/notifications';
  static const String routeSecurity = '/example/security';
  static const String routeBookmarks = '/example/bookmarks';
  static const String routeSearch = '/example/search';
  static const String routeDashboard = '/example/dashboard';

  // Home feature routes - Added for missing routes
  static const String routeUrgentFundraising = '/example/urgent-fundraising';
  static const String routeComingEnd = '/example/coming-end';
  static const String routeWatchImpact = '/example/watch-impact';
  static const String routePrayer = '/example/prayer';

  // Donation feature routes
  static const String routeDonation = '/example/donation';
  static const String routeAlldonation = '/example/all-donation';
  static const String routeFundraising = '/example/fundraising';

  // Route getter methods for external access
  static String getInitialRoute() => routeInitial;
  static String getSplashRoute() => routeSplash;
  static String getHomeRoute() => routeHome;
  static String getOnboardingRoute() => routeOnboarding;
  static String getLoginRoute() => routeLogin;
  static String getSignupRoute() => routeSignup;
  static String getForgotRoute() => routeForgot;
  static String getVerifyRoute() => routeVerify;
  static String getResetRoute() => routeReset;
  static String getCongratulationsRoute() => routeCongratulations;
  static String getProfileRoute() => routeProfile;
  static String getEditProfileRoute() => routeEditProfile;
  static String getChatRoute() => routeChat;
  static String getAboutRoute() => routeAbout;
  static String getSettingsRoute() => routeSettings;
  static String getHelpRoute() => routeHelp;
  static String getNotificationsRoute() => routeNotifications;
  static String getSecurityRoute() => routeSecurity;
  static String getBookmarksRoute() => routeBookmarks;
  static String getSearchRoute() => routeSearch;
  static String getDashboardRoute() => routeDashboard;

  /// Get default route for the Example app
  static String getDefaultRoute() => routeHome;

  /// Get all Example app routes
  static List<RouteBase> getExampleAppRoutes() {
    return [
      // Main routes
      GoRoute(
        path: routeHome,
        name: 'example_home',
        builder: (context, state) => const DashboardScreen(),
      ),

      GoRoute(
        path: routeSplash,
        name: 'example_splash',
        builder: (context, state) => const SplashScreen(),
      ),

      GoRoute(
        path: routeInitial,
        name: 'example_initial',
        builder: (context, state) => const SplashScreen(),
      ),

      GoRoute(
        path: routeDashboard,
        name: 'example_dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),

      // Onboarding and Authentication routes
      GoRoute(
        path: routeOnboarding,
        name: 'example_onboarding',
        builder: (context, state) => const OnbordingView(),
      ),

      GoRoute(
        path: routeLogin,
        name: 'example_login',
        builder: (context, state) => const SignInUpScreenView(),
      ),

      GoRoute(
        path: routeSignup,
        name: 'example_signup',
        builder: (context, state) => const SignInUpScreenView(),
      ),

      GoRoute(
        path: routeForgot,
        name: 'example_forgot',
        builder: (context, state) => const ForgotScreenView(),
      ),

      GoRoute(
        path: routeVerify,
        name: 'example_verify',
        builder: (context, state) => const VerifyScreenView(),
      ),

      GoRoute(
        path: routeReset,
        name: 'example_reset',
        builder: (context, state) => const ResetPasswordView(),
      ),

      GoRoute(
        path: routeCongratulations,
        name: 'example_congratulations',
        builder: (context, state) => const CongratulationScreen(),
      ),

      // Profile and User routes
      GoRoute(
        path: routeProfile,
        name: 'example_profile',
        builder: (context, state) => const CongratulationScreen(), // Placeholder
      ),

      GoRoute(
        path: routeEditProfile,
        name: 'example_edit_profile',
        builder: (context, state) => ProfileEditScreenView(),
      ),

      // Communication routes
      GoRoute(
        path: routeChat,
        name: 'example_chat',
        builder: (context, state) => const ChatScreenView(),
      ),

      // Information routes
      GoRoute(
        path: routeAbout,
        name: 'example_about',
        builder: (context, state) => const AboutScreenView(),
      ),

      // Settings routes
      GoRoute(
        path: routeSettings,
        name: 'example_settings',
        builder: (context, state) => SettingScreenView(),
      ),

      GoRoute(
        path: routeHelp,
        name: 'example_help',
        builder: (context, state) => HelpScreenView(),
      ),

      GoRoute(
        path: routeNotifications,
        name: 'example_notifications',
        builder: (context, state) => const NotificationSettingScreen(),
      ),

      GoRoute(
        path: routeSecurity,
        name: 'example_security',
        builder: (context, state) => const SecuritySettingScreen(),
      ),

      // Feature routes
      GoRoute(
        path: routeBookmarks,
        name: 'example_bookmarks',
        builder: (context, state) => BookMarkScreenView(),
      ),

      GoRoute(
        path: routeSearch,
        name: 'example_search',
        builder: (context, state) => SearchScreenView(),
      ),
    ];
  }

  /// Get route information for debugging
  static Map<String, dynamic> getRouteInfo() {
    final routes = getExampleAppRoutes();
    return {
      'appId': 'example',
      'routePrefix': '/example',
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

  /// Check if a route path belongs to Example app
  static bool isExampleRoute(String path) {
    return path.startsWith('/example/');
  }

  /// Get route name from path
  static String? getRouteNameFromPath(String path) {
    final routes = getExampleAppRoutes();
    for (final route in routes) {
      if (route is GoRoute && route.path == path) {
        return route.name;
      }
    }
    return null;
  }

  /// Get all route paths
  static List<String> getAllRoutePaths() {
    final routes = getExampleAppRoutes();
    return routes.whereType<GoRoute>().map((route) => route.path).toList();
  }

  /// Get all route names
  static List<String> getAllRouteNames() {
    final routes = getExampleAppRoutes();
    return routes.whereType<GoRoute>()
        .map((route) => route.name)
        .where((name) => name != null)
        .cast<String>()
        .toList();
  }
}
