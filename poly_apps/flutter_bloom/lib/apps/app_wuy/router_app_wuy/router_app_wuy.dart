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
import 'package:flutter/material.dart';

// Import Wuy App feature screens
import '../features_app_wuy/profile/views/profile_screen.dart';
import '../features_app_wuy/settings/views/settings_screen.dart';
import '../features_app_wuy/authentication/views/login_screen.dart';
import '../features_app_wuy/authentication/views/login_entry_screen.dart';
import '../features_app_wuy/authentication/views/phone_login_screen.dart';
import '../features_app_wuy/authentication/views/register_screen.dart';
import '../features_app_wuy/authentication/views/login_register_screen.dart';
import '../features_app_wuy/splash/views/splash_screen.dart';
import '../features_app_wuy/dashboard/views/dashboard_screen.dart';
import '../features_app_wuy/friends/views/friends_list_screen.dart';
import '../features_app_wuy/friends/views/friend_info_screen.dart';
import '../features_app_wuy/friends/views/add_friend_screen.dart';
import '../features_app_wuy/friends/views/send_request_screen.dart';
import '../features_app_wuy/chat/views/chat_screen.dart';
import '../features_app_wuy/search/views/search_screen.dart';
import '../features_app_wuy/map/views/map_screen.dart';
import '../features_app_wuy/history/views/history_tracking_screen.dart';
import '../features_app_wuy/network/views/network_records_screen.dart';
import '../features_app_wuy/profile/views/personal_info_screen.dart';
import '../features_app_wuy/about/views/about_screen.dart';
import '../utils_app_wuy/auth_guard.dart';

/// Wuy App Router Configuration
/// Route keys are defined directly in this file to avoid separate constant files
class WuyAppRouter {
  // Route constants with /wuy namespace
  static const String routeHome =
      '/wuy/map'; // Map is the home page (matching React version)
  static const String routeFriends = '/wuy/friends'; // Friends list route
  static const String routeSplash = '/wuy/splash';
  static const String routeInitial = '/wuy/initial';
  static const String routeLogin = '/wuy/login';
  static const String routeLoginEntry = '/wuy/login-entry';
  static const String routePhoneLogin = '/wuy/phone-login';
  static const String routeRegister = '/wuy/register';
  static const String routeLoginRegister = '/wuy/login-register';
  static const String routeProfile = '/wuy/profile';
  static const String routeEditProfile = '/wuy/edit-profile';
  static const String routeSettings = '/wuy/settings';
  static const String routeDashboard = '/wuy/dashboard';
  static const String routeFriendInfo = '/wuy/friend/:id';
  static const String routeFindFriends = '/wuy/find-friends';
  static const String routeAddFriend = '/wuy/add-friend';
  static const String routeSendRequest = '/wuy/send-request';
  static const String routeChat = '/wuy/chat/:id';
  static const String routeSearch = '/wuy/search';
  static const String routeMap = '/wuy/map';
  static const String routeHistoryTracks = '/wuy/history-tracks';
  static const String routeNetworkRecords = '/wuy/network-records';
  static const String routePersonalInfo = '/wuy/personal-info';
  static const String routeAbout = '/wuy/about';

  /// Create router for Wuy app - required by development guidelines
  static GoRouter createRouter() {
    return GoRouter(
      initialLocation: routeSplash, // Always start with splash screen
      routes: [
        // Splash route
        GoRoute(
          path: routeSplash,
          name: 'wuy_splash',
          builder: (context, state) => const WuySplashScreen(),
        ),

        // Home route (Map with Auth Guard) - Primary route (matching React version)
        GoRoute(
          path: routeHome,
          name: 'wuy_home',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyMapScreen(),
          ),
        ),

        // Friends route (matching React version /friends)
        GoRoute(
          path: routeFriends,
          name: 'wuy_friends',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyFriendsListScreen(),
          ),
        ),

        // Authentication routes (with redirect guards)
        GoRoute(
          path: routeLogin,
          name: 'wuy_login',
          builder: (context, state) => AuthGuard.redirectIfAuthenticated(
            context,
            const WuyLoginScreen(),
          ),
        ),

        GoRoute(
          path: routeLoginEntry,
          name: 'wuy_login_entry',
          builder: (context, state) => AuthGuard.redirectIfAuthenticated(
            context,
            const WuyLoginEntryScreen(),
          ),
        ),

        GoRoute(
          path: routePhoneLogin,
          name: 'wuy_phone_login',
          builder: (context, state) => AuthGuard.redirectIfAuthenticated(
            context,
            const WuyPhoneLoginScreen(),
          ),
        ),

        GoRoute(
          path: routeRegister,
          name: 'wuy_register',
          builder: (context, state) => AuthGuard.redirectIfAuthenticated(
            context,
            const WuyRegisterScreen(),
          ),
        ),

        GoRoute(
          path: routeLoginRegister,
          name: 'wuy_login_register',
          builder: (context, state) => AuthGuard.redirectIfAuthenticated(
            context,
            const WuyLoginRegisterScreen(),
          ),
        ),

        // Dashboard route
        GoRoute(
          path: routeDashboard,
          name: 'wuy_dashboard',
          builder: (context, state) => const WuyDashboardScreen(),
        ),

        // Profile route
        GoRoute(
          path: routeProfile,
          name: 'wuy_profile',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyProfileScreen(),
          ),
        ),

        // Edit Profile route
        GoRoute(
          path: routeEditProfile,
          name: 'wuy_edit_profile',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyPersonalInfoScreen(),
          ),
        ),

        // Settings route (available without login)
        GoRoute(
          path: routeSettings,
          name: 'wuy_settings',
          builder: (context, state) => const WuySettingsScreen(),
        ),

        // Friend info route
        GoRoute(
          path: routeFriendInfo,
          name: 'wuy_friend_info',
          builder: (context, state) {
            final friendId = state.pathParameters['id'] ?? '';
            return AuthGuard.requireAuth(
              context,
              WuyFriendInfoScreen(friendId: friendId),
            );
          },
        ),

        // Find friends route
        GoRoute(
          path: routeFindFriends,
          name: 'wuy_find_friends',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuySearchScreen(),
          ),
        ),

        // Add friend route
        GoRoute(
          path: routeAddFriend,
          name: 'wuy_add_friend',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyAddFriendScreen(),
          ),
        ),

        // Send request route
        GoRoute(
          path: routeSendRequest,
          name: 'wuy_send_request',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuySendRequestScreen(),
          ),
        ),

        // Chat route
        GoRoute(
          path: routeChat,
          name: 'wuy_chat',
          builder: (context, state) {
            final friendId = state.pathParameters['id'] ?? '';
            final friendName = state.uri.queryParameters['name'];
            return AuthGuard.requireAuth(
              context,
              WuyChatScreen(
                friendId: friendId,
                friendName: friendName,
              ),
            );
          },
        ),

        // Search route
        GoRoute(
          path: routeSearch,
          name: 'wuy_search',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuySearchScreen(),
          ),
        ),

        // Map route
        GoRoute(
          path: routeMap,
          name: 'wuy_map',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyMapScreen(),
          ),
        ),

        // History tracking route
        GoRoute(
          path: routeHistoryTracks,
          name: 'wuy_history_tracks',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyHistoryTrackingScreen(),
          ),
        ),

        // Network records route
        GoRoute(
          path: routeNetworkRecords,
          name: 'wuy_network_records',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyNetworkRecordsScreen(),
          ),
        ),

        // Personal info route
        GoRoute(
          path: routePersonalInfo,
          name: 'wuy_personal_info',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyPersonalInfoScreen(),
          ),
        ),

        // About route
        GoRoute(
          path: routeAbout,
          name: 'wuy_about',
          builder: (context, state) => AuthGuard.requireAuth(
            context,
            const WuyAboutScreen(),
          ),
        ),

        // Initial route (redirect to home)
        GoRoute(
          path: routeInitial,
          name: 'wuy_initial',
          redirect: (context, state) => routeHome,
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        appBar: AppBar(
          title: const Text('Page Not Found'),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.grey,
              ),
              const SizedBox(height: 16),
              Text(
                'Page not found: ${state.uri.toString()}',
                style: const TextStyle(fontSize: 18),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.go(routeHome),
                child: const Text('Go Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Route getter methods for external access
  static String getInitialRoute() => routeInitial;
  static String getSplashRoute() => routeSplash;
  static String getHomeRoute() => routeHome;
  static String getLoginRoute() => routeLogin;
  static String getLoginEntryRoute() => routeLoginEntry;
  static String getPhoneLoginRoute() => routePhoneLogin;
  static String getRegisterRoute() => routeRegister;
  static String getLoginRegisterRoute() => routeLoginRegister;
  static String getProfileRoute() => routeProfile;
  static String getEditProfileRoute() => routeEditProfile;
  static String getSettingsRoute() => routeSettings;
  static String getDashboardRoute() => routeDashboard;
  static String getFriendsRoute() => routeFriends;
  static String getFriendInfoRoute(String id) =>
      routeFriendInfo.replaceAll(':id', id);
  static String getFindFriendsRoute() => routeFindFriends;
  static String getAddFriendRoute() => routeAddFriend;
  static String getSendRequestRoute() => routeSendRequest;
  static String getSearchRoute() => routeSearch;
  static String getMapRoute() => routeMap;
  static String getHistoryTracksRoute() => routeHistoryTracks;
  static String getNetworkRecordsRoute() => routeNetworkRecords;
  static String getPersonalInfoRoute() => routePersonalInfo;
  static String getAboutRoute() => routeAbout;

  /// Get default route for the Wuy app
  static String getDefaultRoute() => routeHome;

  /// Get all route paths
  static List<String> getAllRoutes() {
    return [
      routeHome,
      routeSplash,
      routeInitial,
      routeLogin,
      routeLoginEntry,
      routePhoneLogin,
      routeRegister,
      routeLoginRegister,
      routeProfile,
      routeSettings,
      routeDashboard,
      routeFriends,
      routeFindFriends,
      routeAddFriend,
      routeSearch,
      routeMap,
      routeHistoryTracks,
      routeNetworkRecords,
      routePersonalInfo,
      routeAbout,
    ];
  }
}
