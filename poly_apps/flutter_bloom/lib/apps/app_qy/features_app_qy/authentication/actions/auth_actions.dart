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

    final authController = Provider.of<AuthControllerAppQy>(context, listen: false);

    try {
      final success = await authController.login(
        username: username,
        password: password,
      );

      if (success) {
        if (rememberMe) {
          final credentialsJson = json.encode({
            'enabled': true,
            'username': username,
            'password': password,
          });
          CacheOperations.set('remember_me', credentialsJson);
        }

        onResult('login.success'.tr(context), false);

        await Future.delayed(const Duration(milliseconds: 100));
        context.pushReplacement(QyAppRoutesProvider.routeHome);
      } else {
        onResult(authController.error ?? 'login.failed'.tr(context), true);
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

    final authController = Provider.of<AuthControllerAppQy>(context, listen: false);

    try {
      onResult('signup.not_implemented'.tr(context), true);
    } catch (e) {
      debugPrint('Error signing up: $e');
      onResult('signup.error'.tr(context), true);
    }
  }
}
