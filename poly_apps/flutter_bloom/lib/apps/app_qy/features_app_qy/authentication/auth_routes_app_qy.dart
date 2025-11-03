/// Authentication routes for app_qy
library auth_routes_app_qy;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../provider_app_qy/user_provider_app_qy.dart';
import 'views/login_screen_v2_app_qy.dart';
import '../../home/views/home_screen_app_qy.dart';

class AuthRoutesAppQy {
  static const String login = '/login';
  static const String home = '/home';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';

  /// Get authentication routes
  static Map<String, Widget Function(BuildContext)> getRoutes() {
    return {
      login: (context) => const LoginScreenV2AppQy(),
      home: (context) => const HomeScreenAppQy(),
      // Add more routes as needed
      // register: (context) => const RegisterScreen(),
      // forgotPassword: (context) => const ForgotPasswordScreen(),
    };
  }

  /// Route guard for authenticated routes
  static Widget Function(BuildContext) requireAuth(
    Widget Function(BuildContext) builder,
  ) {
    return (context) {
      final userProvider = Provider.of<UserProviderAppQy>(context, listen: false);

      return FutureBuilder<bool>(
        future: userProvider.validateSession(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }

          final isValid = snapshot.data ?? false;

          if (!isValid) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              Navigator.of(context).pushReplacementNamed(login);
            });
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }

          return builder(context);
        },
      );
    };
  }

  /// Redirect to home if already authenticated
  static Widget Function(BuildContext) redirectIfAuthenticated(
    Widget Function(BuildContext) builder,
  ) {
    return (context) {
      final userProvider = Provider.of<UserProviderAppQy>(context, listen: false);

      if (userProvider.isAuthenticated) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Navigator.of(context).pushReplacementNamed('/home');
        });
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        );
      }

      return builder(context);
    };
  }
}