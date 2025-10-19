// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/auth_controller_app_qy.dart';
import 'package:qyflutter/apps/app_qy/model_app_qy/user_model.dart';
import 'package:qyflutter/apps/app_qy/providers_app_qy/qy_user_provider.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:qyflutter/common/utils/database/cache_operations.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';

class AuthActions {
  static Future<void> handleLogin(
    BuildContext context, {
    required String username,
    required String password,
    required bool rememberMe,
    required Function(String, bool) onResult,
  }) async {
    if (username.isEmpty || username.length < 3) {
      onResult('validation.username_required'.tr(context), true);
      return;
    }

    if (password.isEmpty || password.length < 6) {
      onResult('validation.password_required'.tr(context), true);
      return;
    }

    final AuthControllerAppQy authController = AuthControllerAppQy(context);
    // Fix: Use QyUserProvider for proper type handling
    final userProvider = Provider.of<QyUserProvider>(context, listen: false);

    try {
      final response = await authController.login(
        username,
        password,
        rememberMe,
      );

      if (response.statusCode == 200) {
        if (rememberMe) {
          final credentialsJson = json.encode({
            'enabled': true,
            'username': username,
            'password': password,
          });
          CacheOperations.set('remember_me', credentialsJson);
        }

        final userData = response.data!['user'] as Map<String, dynamic>;
        final user = UserModel.fromJson(userData);
        user.token = response.data!['token'];
        user.tokenType = response.data!['token_type'];
        user.expiration = response.data!['expiration']?.toString();

        // Fix: Use setAppUser method from QyUserProvider
        userProvider.setAppUser(profile: user);
        onResult('login.success'.tr(context), false);

        await Future.delayed(const Duration(milliseconds: 100));
        context.pushReplacement(QyAppRoutesProvider.routeHome);
      } else {
        onResult(response.message ?? 'login.failed'.tr(context), true);
      }
    } catch (e) {
      debugPrint('Error logging in: $e');
      onResult('login.error'.tr(context), true);
    }
  }

  static Future<void> handleSignUp(
    BuildContext context, {
    required String username,
    required String password,
    required String confirmPassword,
    required Function(String, bool) onResult,
  }) async {
    if (username.isEmpty) {
      onResult('Please enter username', true);
      return;
    }

    if (password.isEmpty || password.length < 6) {
      onResult('validation.password_required'.tr(context), true);
      return;
    }

    if (password != confirmPassword) {
      onResult('Passwords do not match', true);
      return;
    }

    final AuthControllerAppQy authController = AuthControllerAppQy(context);

    try {
      final response = await authController.register(
        email: username,
        password: password,
        username: username,
      );

      if (response.isSuccess) {
        onResult('signup.success'.tr(context), false);
        await Future.delayed(const Duration(milliseconds: 100));
        context.pushReplacement(QyAppRoutesProvider.routeCongratulations);
      } else {
        onResult(response.message ?? 'signup.failed'.tr(context), true);
      }
    } catch (e) {
      debugPrint('Error signing up: $e');
      onResult('signup.error'.tr(context), true);
    }
  }
}
