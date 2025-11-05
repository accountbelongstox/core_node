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

// Import QY App feature screens
import '../features_app_qy/splash/views/splash_screen.dart';
import '../features_app_qy/dashboard/views/dashboard_screen.dart';
import '../features_app_qy/onbording/views/onbording_screen.dart';
import '../features_app_qy/authentication/views/signin_up_screen.dart';
import '../features_app_qy/authentication/views/forgot_screen.dart';
import '../features_app_qy/authentication/views/verify_screen.dart';
import '../features_app_qy/authentication/views/resetpassword_screen.dart';
import '../features_app_qy/authentication/views/congratulation_screen.dart';
import '../features_app_qy/profile/views/edit_profile.dart';
import '../features_app_qy/inbox/views/chat_screen.dart';
import '../features_app_qy/about/about_screen.dart';
import '../features_app_qy/setting/views/setting_screen_view.dart';
import '../features_app_qy/setting/views/help_screen.dart';
import '../features_app_qy/setting/views/notification_setting.dart';
import '../features_app_qy/setting/views/security_screen.dart';
import '../features_app_qy/bookmark/bookmark_screen.dart';
import '../features_app_qy/search/search_screen.dart';

/// QY App Routes Provider
/// Provides routes for the QY app following the dual-entry architecture
/// Route keys are defined directly in this file to avoid separate constant files
class QyAppRoutesProvider {
  // Route constants with /qy namespace
  static const String routeHome = '/qy/home';
  static const String routeSplash = '/qy/splash';
  static const String routeInitial = '/qy/initial';
  static const String routeOnboarding = '/qy/onboarding';
  static const String routeLogin = '/qy/login';
  static const String routeSignup = '/qy/signup';
  static const String routeForgot = '/qy/forgot';
  static const String routeVerify = '/qy/verify';
  static const String routeReset = '/qy/reset';
  static const String routeCongratulations = '/qy/congratulations';
  static const String routeProfile = '/qy/profile';
  static const String routeEditProfile = '/qy/edit-profile';
  static const String routeChat = '/qy/chat';
  static const String routeAbout = '/qy/about';
  static const String routeSettings = '/qy/settings';
  static const String routeHelp = '/qy/help';
  static const String routeNotifications = '/qy/notifications';
  static const String routeSecurity = '/qy/security';
  static const String routeBookmarks = '/qy/bookmarks';
  static const String routeSearch = '/qy/search';
  static const String routeDashboard = '/qy/dashboard';

  // Home feature routes - Added for missing routes
  static const String routeUrgentFundraising = '/qy/urgent-fundraising';
  static const String routeComingEnd = '/qy/coming-end';
  static const String routeWatchImpact = '/qy/watch-impact';
  static const String routePrayer = '/qy/prayer';

  // Donation feature routes
  static const String routeDonation = '/qy/donation';
  static const String routeAlldonation = '/qy/all-donation';
  static const String routeFundraising = '/qy/fundraising';

  /// Create GoRouter configuration for QY app
  static GoRouter createRouter({String? initialLocation}) {
    final String effectiveInitialLocation =
        initialLocation ?? routeSplash;
    return GoRouter(
      initialLocation: effectiveInitialLocation,
      routes: getQyAppRoutes(),
    );
  }

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

  /// Get default route for the QY app
  static String getDefaultRoute() => routeHome;

  /// Get all QY app routes
  static List<RouteBase> getQyAppRoutes() {
    return [
      // Main routes
      GoRoute(
        path: routeHome,
        name: 'qy_home',
        builder: (context, state) => const DashboardScreen(),
      ),

      GoRoute(
        path: routeSplash,
        name: 'qy_splash',
        builder: (context, state) => const SplashScreen(),
      ),

      GoRoute(
        path: routeInitial,
        name: 'qy_initial',
        builder: (context, state) => const SplashScreen(),
      ),

      GoRoute(
        path: routeDashboard,
        name: 'qy_dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),

      // Onboarding and Authentication routes
      GoRoute(
        path: routeOnboarding,
        name: 'qy_onboarding',
        builder: (context, state) => const OnbordingView(),
      ),

      GoRoute(
        path: routeLogin,
        name: 'qy_login',
        builder: (context, state) => const SignInUpScreenView(),
      ),

      GoRoute(
        path: routeSignup,
        name: 'qy_signup',
        builder: (context, state) => const SignInUpScreenView(),
      ),

      GoRoute(
        path: routeForgot,
        name: 'qy_forgot',
        builder: (context, state) => const ForgotScreenView(),
      ),

      GoRoute(
        path: routeVerify,
        name: 'qy_verify',
        builder: (context, state) => const VerifyScreenView(),
      ),

      GoRoute(
        path: routeReset,
        name: 'qy_reset',
        builder: (context, state) => const ResetPasswordView(),
      ),

      GoRoute(
        path: routeCongratulations,
        name: 'qy_congratulations',
        builder: (context, state) => const CongratulationScreen(),
      ),

      // Profile and User routes
      GoRoute(
        path: routeProfile,
        name: 'qy_profile',
        builder: (context, state) => const CongratulationScreen(), // Placeholder
      ),

      GoRoute(
        path: routeEditProfile,
        name: 'qy_edit_profile',
        builder: (context, state) => ProfileEditScreenView(),
      ),

      // Communication routes
      GoRoute(
        path: routeChat,
        name: 'qy_chat',
        builder: (context, state) => const ChatScreenView(),
      ),

      // Information routes
      GoRoute(
        path: routeAbout,
        name: 'qy_about',
        builder: (context, state) => const AboutScreenView(),
      ),

      // Settings routes
      GoRoute(
        path: routeSettings,
        name: 'qy_settings',
        builder: (context, state) => SettingScreenView(),
      ),

      GoRoute(
        path: routeHelp,
        name: 'qy_help',
        builder: (context, state) => HelpScreenView(),
      ),

      GoRoute(
        path: routeNotifications,
        name: 'qy_notifications',
        builder: (context, state) => const NotificationSettingScreen(),
      ),

      GoRoute(
        path: routeSecurity,
        name: 'qy_security',
        builder: (context, state) => const SecuritySettingScreen(),
      ),

      // Feature routes
      GoRoute(
        path: routeBookmarks,
        name: 'qy_bookmarks',
        builder: (context, state) => BookMarkScreenView(),
      ),

      GoRoute(
        path: routeSearch,
        name: 'qy_search',
        builder: (context, state) => SearchScreenView(),
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
    return routes.whereType<GoRoute>()
        .map((route) => route.name)
        .where((name) => name != null)
        .cast<String>()
        .toList();
  }
}
