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
import '../services_app_wuy/wuy_auth_state_manager.dart';
import '../services_app_wuy/wuy_avatar_service.dart';
import '../router_app_wuy/router_app_wuy.dart';

/// Authentication Guard for Wuy App
/// Handles authentication state checking and route protection
class AuthGuard {
  /// Check if user is authenticated - using unified auth state manager
  static bool isAuthenticated(BuildContext context) {
    // Use auth state manager for consistent authentication check
    return WuyAuthStateManager.instance.isAuthenticated;
  }

  /// Get initial route based on authentication status
  static String getInitialRoute(BuildContext context) {
    // Use auth state manager for route determination
    return WuyAuthStateManager.instance.getInitialRoute();
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

  /// Redirect to home if already authenticated (for login/register pages)
  static Widget redirectIfAuthenticated(BuildContext context, Widget child) {
    return FutureBuilder<bool>(
      future: _checkAuthAsync(context),
      builder: (context, snapshot) {
        // Show loading while checking auth state
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        final isAuthenticated = snapshot.data ?? false;
        
        if (isAuthenticated) {
          // Redirect to home page if already authenticated
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              debugPrint('AuthGuard: Redirecting authenticated user to home page');
              context.go(WuyAppRouter.routeHome);
            }
          });
          return const Scaffold(
            body: Center(
              child: Text('Redirecting to home...'),
            ),
          );
        } else {
          return child;
        }
      },
    );
  }

  /// Async authentication check - use unified auth state manager
  static Future<bool> _checkAuthAsync(BuildContext context) async {
    try {
      // Use auth state manager as single source of truth
      final authStateManager = WuyAuthStateManager.instance;
      
      debugPrint('AuthGuard: Checking authentication state...');
      debugPrint('AuthGuard: isAuthenticated = ${authStateManager.isAuthenticated}');
      debugPrint('AuthGuard: currentUser = ${authStateManager.currentUser?.displayName}');
      
      // Validate auth state to ensure it's still valid
      final isValid = await authStateManager.validateAuthState();
      if (!isValid) {
        debugPrint('AuthGuard: Auth state validation failed');
        return false;
      }
      
      // Sync user provider with auth state manager
      final userProvider = Provider.of<WuUserProvider>(context, listen: false);
      userProvider.syncWithAuthStateManager();
      
      final isAuth = authStateManager.isAuthenticated;
      debugPrint('AuthGuard: Final authentication check result = $isAuth');
      
      return isAuth;
    } catch (e) {
      debugPrint('AuthGuard: Error in async auth check: $e');
      return false;
    }
  }

  /// Handle login success with proper state synchronization
  static Future<void> onLoginSuccess(BuildContext context) async {
    try {
      // Use auth state manager for login success handling
      final authStateManager = WuyAuthStateManager.instance;
      final user = authStateManager.currentUser;
      
      if (user != null) {
        debugPrint('Login success for user: ${user.displayName}');
        
        // Ensure user provider is synced with auth state manager
        final userProvider = Provider.of<WuUserProvider>(context, listen: false);
        userProvider.syncWithAuthStateManager();
        
        // Add a small delay to ensure state synchronization
        await Future.delayed(const Duration(milliseconds: 100));
        
        // Navigate to home page (friends list)
        if (context.mounted) {
          debugPrint('AuthGuard: Navigating to home route: ${WuyAppRouter.routeHome}');
          context.go(WuyAppRouter.routeHome);
        }
      } else {
        debugPrint('Login success but no user found in auth state manager');
      }
    } catch (e) {
      debugPrint('Error in onLoginSuccess: $e');
      // Fallback navigation
      if (context.mounted) {
        debugPrint('AuthGuard: Fallback navigation to home route: ${WuyAppRouter.routeHome}');
        context.go(WuyAppRouter.routeHome);
      }
    }
  }

  /// Handle logout
  static Future<void> onLogout(BuildContext context) async {
    try {
      debugPrint('AuthGuard: Starting logout process...');

      final authStateManager = WuyAuthStateManager.instance;
      final userProvider = Provider.of<WuUserProvider>(context, listen: false);
      final avatarService = WuyAvatarService();

      debugPrint('AuthGuard: Clearing auth state manager...');
      await authStateManager.clearAuthentication();

      debugPrint('AuthGuard: Clearing user provider...');
      userProvider.clearUser();

      debugPrint('AuthGuard: Clearing avatar cache...');
      await avatarService.clearAllCache();

      debugPrint('AuthGuard: Logout complete. Navigating to login...');

      if (context.mounted) {
        context.go(WuyAppRouter.routeLoginEntry);
      }
    } catch (e) {
      debugPrint('AuthGuard: Error during logout: $e');
      if (context.mounted) {
        context.go(WuyAppRouter.routeLoginEntry);
      }
    }
  }
}
