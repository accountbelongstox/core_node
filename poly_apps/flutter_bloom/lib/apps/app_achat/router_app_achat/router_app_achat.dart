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

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// Import all feature screens
import 'package:qyflutter/apps/app_achat/features_app_achat/home/views/home_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_home/views/chat_home_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/add_contacts/views/add_contacts_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/app_lock/views/app_lock_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_details/views/chat_details_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_list/views/chat_list_screen.dart';

import 'package:qyflutter/apps/app_achat/features_app_achat/contacts/views/contacts_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/create_group/views/create_group_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/discover/views/discover_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/group_chat/views/group_chat_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/language_settings/views/language_settings_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/new_chat/views/new_chat_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/notification_setting/views/notification_setting_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/privacy_security/views/privacy_security_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/profile/views/profile_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/proxy_settings/views/proxy_settings_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/qr_profile/views/qr_profile_screen.dart';

/// AChat application router with namespace
/// All routes follow the pattern: /achat/{feature}
class RouterAppAChat {
  /// Route constants with achat namespace
  static const String home = '/achat/home'; // Changed from /achat/chat_home
  static const String addContacts = '/achat/add_contacts';
  static const String appLock = '/achat/app_lock';
  static const String chatDetails = '/achat/chat_details';
  static const String chatList = '/achat/chat_list';

  static const String contacts = '/achat/contacts';
  static const String createGroup = '/achat/create_group';
  static const String discover = '/achat/discover';
  static const String groupChat = '/achat/group_chat';
  static const String languageSettings = '/achat/language_settings';
  static const String newChat = '/achat/new_chat';
  static const String notificationSetting = '/achat/notification_setting';
  static const String privacySecurity = '/achat/privacy_security';
  static const String profile = '/achat/profile';
  static const String proxySettings = '/achat/proxy_settings';
  static const String qrProfile = '/achat/qr_profile';

  // Legacy route constants for backward compatibility
  static const String achatHome = home;
  static const String achatChatHome = home; // Updated to point to new home
  static const String achatProfile = profile;
  static const String achatNewChat = newChat;

  /// Create router configuration
  static List<RouteBase> getRoutes() {
    return [
      // Home route - now points to ChatHomeScreen
      GoRoute(
        path: home,
        name: 'achat_home',
        builder: (context, state) => const ChatHomeScreen(), // Changed from AchatHomeScreen to ChatHomeScreen
      ),
      
      // Add Contacts route
      GoRoute(
        path: addContacts,
        name: 'achat_add_contacts',
        builder: (context, state) => const AddContactsScreen(),
      ),
      
      // App Lock route
      GoRoute(
        path: appLock,
        name: 'achat_app_lock',
        builder: (context, state) => const AppLockScreen(),
      ),
      
      // Chat Details route with parameter
      GoRoute(
        path: '$chatDetails/:chatId',
        name: 'achat_chat_details',
        builder: (context, state) {
          final chatId = state.pathParameters['chatId'] ?? '';
          return ChatDetailsScreen(chatId: chatId);
        },
      ),
      
      // Chat List route
      GoRoute(
        path: chatList,
        name: 'achat_chat_list',
        builder: (context, state) => const ChatListScreen(),
      ),
      

      
      // Contacts route
      GoRoute(
        path: contacts,
        name: 'achat_contacts',
        builder: (context, state) => const ContactsScreen(),
      ),
      
      // Create Group route
      GoRoute(
        path: createGroup,
        name: 'achat_create_group',
        builder: (context, state) => const CreateGroupScreen(),
      ),
      
      // Discover route
      GoRoute(
        path: discover,
        name: 'achat_discover',
        builder: (context, state) => const DiscoverScreen(),
      ),
      
      // Group Chat route with parameter
      GoRoute(
        path: '$groupChat/:groupId',
        name: 'achat_group_chat',
        builder: (context, state) {
          final groupId = state.pathParameters['groupId'] ?? '';
          return GroupChatScreen(groupId: groupId);
        },
      ),
      
      // Language Settings route
      GoRoute(
        path: languageSettings,
        name: 'achat_language_settings',
        builder: (context, state) => const LanguageSettingsScreen(),
      ),
      
      // New Chat route
      GoRoute(
        path: newChat,
        name: 'achat_new_chat',
        builder: (context, state) => const NewChatScreen(),
      ),
      
      // Notification Setting route
      GoRoute(
        path: notificationSetting,
        name: 'achat_notification_setting',
        builder: (context, state) => const NotificationSettingScreen(),
      ),
      
      // Privacy Security route
      GoRoute(
        path: privacySecurity,
        name: 'achat_privacy_security',
        builder: (context, state) => const PrivacySecurityScreen(),
      ),
      
      // Profile route
      GoRoute(
        path: profile,
        name: 'achat_profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      
      // Proxy Settings route
      GoRoute(
        path: proxySettings,
        name: 'achat_proxy_settings',
        builder: (context, state) => const ProxySettingsScreen(),
      ),
      
      // QR Profile route
      GoRoute(
        path: qrProfile,
        name: 'achat_qr_profile',
        builder: (context, state) => const QrProfileScreen(),
      ),
    ];
  }

  /// Navigation helper methods using context.go()
  static void goToHome(BuildContext context) => context.go(home);
  static void goToChatHome(BuildContext context) => context.go(home); // Changed from chatHome to home
  static void goToAddContacts(BuildContext context) => context.go(addContacts);
  static void goToAppLock(BuildContext context) => context.go(appLock);
  static void goToChatDetails(BuildContext context, String chatId) => 
      context.go('$chatDetails/$chatId');
  static void goToChatList(BuildContext context) => context.go(chatList);

  static void goToContacts(BuildContext context) => context.go(contacts);
  static void goToCreateGroup(BuildContext context) => context.go(createGroup);
  static void goToDiscover(BuildContext context) => context.go(discover);
  static void goToGroupChat(BuildContext context, String groupId) => 
      context.go('$groupChat/$groupId');
  static void goToLanguageSettings(BuildContext context) => context.go(languageSettings);
  static void goToNewChat(BuildContext context) => context.go(newChat);
  static void goToNotificationSetting(BuildContext context) => context.go(notificationSetting);
  static void goToPrivacySecurity(BuildContext context) => context.go(privacySecurity);
  static void goToProfile(BuildContext context) => context.go(profile);
  static void goToProxySettings(BuildContext context) => context.go(proxySettings);
  static void goToQrProfile(BuildContext context) => context.go(qrProfile);

  /// Navigation helper methods using context.push() for stacking
  static void pushToHome(BuildContext context) => context.push(home);
  static void pushToChatHome(BuildContext context) => context.push(home); // Changed from chatHome to home
  static void pushToAddContacts(BuildContext context) => context.push(addContacts);
  static void pushToAppLock(BuildContext context) => context.push(appLock);
  static void pushToChatDetails(BuildContext context, String chatId) => 
      context.push('$chatDetails/$chatId');
  static void pushToChatList(BuildContext context) => context.push(chatList);

  static void pushToContacts(BuildContext context) => context.push(contacts);
  static void pushToCreateGroup(BuildContext context) => context.push(createGroup);
  static void pushToDiscover(BuildContext context) => context.push(discover);
  static void pushToGroupChat(BuildContext context, String groupId) => 
      context.push('$groupChat/$groupId');
  static void pushToLanguageSettings(BuildContext context) => context.push(languageSettings);
  static void pushToNewChat(BuildContext context) => context.push(newChat);
  static void pushToNotificationSetting(BuildContext context) => context.push(notificationSetting);
  static void pushToPrivacySecurity(BuildContext context) => context.push(privacySecurity);
  static void pushToProfile(BuildContext context) => context.push(profile);
  static void pushToProxySettings(BuildContext context) => context.push(proxySettings);
  static void pushToQrProfile(BuildContext context) => context.push(qrProfile);

  /// Navigation using named routes
  static void goToNamed(BuildContext context, String name, {Map<String, String>? pathParameters}) => 
      context.goNamed(name, pathParameters: pathParameters ?? {});
  static void pushNamed(BuildContext context, String name, {Map<String, String>? pathParameters}) => 
      context.pushNamed(name, pathParameters: pathParameters ?? {});

  /// Extended router functionality
  
  /// Get all route paths for debugging/validation
  static List<String> getAllRoutePaths() {
    return [
      home,
      addContacts,
      appLock,
      chatDetails,
      chatList,
      
      contacts,
      createGroup,
      discover,
      groupChat,
      languageSettings,
      newChat,
      notificationSetting,
      privacySecurity,
      profile,
      proxySettings,
      qrProfile,
    ];
  }

  /// Get route display names for debugging/showcase
  static Map<String, String> getRouteDisplayNames() {
    return {
      home: 'AChat Home',
      addContacts: 'Add Contacts',
      appLock: 'App Lock',
      chatDetails: 'Chat Details',
      chatList: 'Chat List',
      
      contacts: 'Contacts',
      createGroup: 'Create Group',
      discover: 'Discover',
      groupChat: 'Group Chat',
      languageSettings: 'Language Settings',
      newChat: 'New Chat',
      notificationSetting: 'Notification Settings',
      privacySecurity: 'Privacy & Security',
      profile: 'Profile',
      proxySettings: 'Proxy Settings',
      qrProfile: 'QR Profile',
    };
  }

  /// Get app router information
  static Map<String, dynamic> getRouterInfo() {
    return {
      'appId': 'achat',
      'appName': 'AChat',
      'namespace': '/achat',
      'defaultRoute': home,
      'homeRoute': home,
      'totalRoutes': getAllRoutePaths().length,
      'routePaths': getAllRoutePaths(),
      'routeNames': getRouteDisplayNames(),
    };
  }

  /// Validate if a route path exists
  static bool isValidRoute(String path) {
    return getAllRoutePaths().contains(path);
  }

  /// Get default route for app initialization
  static String getDefaultRoute() => home;
  
  /// Get home route for navigation
  static String getHomeRoute() => home;

  /// Create GoRouter instance for MaterialApp.router
  static GoRouter createRouter() {
    return GoRouter(
      initialLocation: home,
      routes: getRoutes(),
      errorBuilder: (context, state) => Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                'Page not found: ${state.uri.path}',
                style: const TextStyle(fontSize: 18),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.go(home),
                child: const Text('Go Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}