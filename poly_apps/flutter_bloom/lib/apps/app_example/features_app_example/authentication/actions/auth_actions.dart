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
import 'package:qyflutter/apps/app_example/controller_app_example/auth_controller_app_example.dart';
import 'package:qyflutter/apps/app_example/model_app_example/user_model.dart';
import 'package:qyflutter/apps/app_example/providers_app_example/example_user_provider.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:qyflutter/common/utils/database/cache_operations.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';

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

    final AuthControllerAppExample authController = AuthControllerAppExample(context);
    // Fix: Use ExampleUserProvider for proper type handling
    final userProvider = Provider.of<ExampleUserProvider>(context, listen: false);

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

        final userData = response.body['user'] as Map<String, dynamic>;
        final user = UserModel.fromJson(userData);
        user.token = response.body['token'];
        user.tokenType = response.body['token_type'];
        user.expiration = response.body['expiration']?.toString();

        // Fix: Use setAppUser method from ExampleUserProvider
        userProvider.setAppUser(profile: user);
        onResult('login.success'.tr(context), false);

        await Future.delayed(const Duration(milliseconds: 100));
        context.pushReplacement(ExampleAppRoutesProvider.routeHome);
      } else {
        onResult(response.statusText ?? 'login.failed'.tr(context), true);
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

    final AuthControllerAppExample authController = AuthControllerAppExample(context);

    try {
      final response = await authController.register(
        email: username,
        password: password,
        username: username,
      );

      if (response.statusCode == 200) {
        onResult('signup.success'.tr(context), false);
        await Future.delayed(const Duration(milliseconds: 100));
        context.pushReplacement(ExampleAppRoutesProvider.routeCongratulations);
      } else {
        onResult(response.statusText ?? 'signup.failed'.tr(context), true);
      }
    } catch (e) {
      debugPrint('Error signing up: $e');
      onResult('signup.error'.tr(context), true);
    }
  }
}
