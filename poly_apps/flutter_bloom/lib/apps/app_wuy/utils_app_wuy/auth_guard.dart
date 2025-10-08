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
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers_app_wuy/wu_user_provider.dart';
import '../router_app_wuy/router_app_wuy.dart';

/// Authentication Guard for Wuy App
/// Handles authentication state checking and route protection
class AuthGuard {
  /// Check if user is authenticated
  static bool isAuthenticated(BuildContext context) {
    try {
      final userProvider = Provider.of<WuUserProvider>(context, listen: false);
      return userProvider.isAuthenticated;
    } catch (e) {
      // If provider is not available, assume not authenticated
      return false;
    }
  }

  /// Get initial route based on authentication status
  static String getInitialRoute(BuildContext context) {
    return isAuthenticated(context) 
        ? WuyAppRouter.routeFriends  // Friends list as home page
        : WuyAppRouter.routeLoginEntry;
  }

  /// Check authentication and redirect if needed
  static Widget checkAuth(BuildContext context, Widget child) {
    if (isAuthenticated(context)) {
      return child;
    } else {
      // Redirect to login page using GoRouter
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go(WuyAppRouter.routeLoginEntry);
      });
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }
  }

  /// Require authentication for a route
  static Widget requireAuth(BuildContext context, Widget child) {
    return FutureBuilder<bool>(
      future: _checkAuthAsync(context),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        if (snapshot.data == true) {
          return child;
        } else {
          // Redirect to login using GoRouter
          WidgetsBinding.instance.addPostFrameCallback((_) {
            context.go(WuyAppRouter.routeLoginEntry);
          });
          return const Scaffold(
            body: Center(
              child: Text('Redirecting to login...'),
            ),
          );
        }
      },
    );
  }

  /// Async authentication check
  static Future<bool> _checkAuthAsync(BuildContext context) async {
    try {
      final userProvider = Provider.of<WuUserProvider>(context, listen: false);
      return userProvider.isAuthenticated;
    } catch (e) {
      return false;
    }
  }

  /// Handle login success
  static void onLoginSuccess(BuildContext context) {
    context.go(WuyAppRouter.routeFriends);
  }

  /// Handle logout
  static void onLogout(BuildContext context) {
    context.go(WuyAppRouter.routeLoginEntry);
  }
}
