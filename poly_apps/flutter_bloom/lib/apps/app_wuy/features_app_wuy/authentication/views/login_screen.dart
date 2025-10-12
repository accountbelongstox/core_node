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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_common_background.dart';
import '../../../widgets_app_wuy/wuy_common_logo.dart';
import '../../../utils_app_wuy/auth_guard.dart';
import '../../../services_app_wuy/wuy_auth_state_manager.dart';
import '../../../models_app_wuy/user_model_app_wuy.dart';

/// Login Screen for Wuy App
/// 
/// This screen provides traditional email/password login functionality.
/// 
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyLoginTitle.tr(context)
class WuyLoginScreen extends StatefulWidget {
  const WuyLoginScreen({super.key});

  @override
  State<WuyLoginScreen> createState() => _WuyLoginScreenState();
}

class _WuyLoginScreenState extends State<WuyLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return WuyCommonBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: Text(
            LocalizationKeysAppWuy.wuyLoginTitle.tr(context),
            style: ThemeTextStyles.displayMedium,
          ),
          backgroundColor: ThemeColors.primary,
          elevation: 0,
        ),
        body: SingleChildScrollView(
          padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildLogo(),
                SizedBox(height: ThemeDimensions.spacingXLarge),
                _buildEmailField(),
                SizedBox(height: ThemeDimensions.spacingMedium),
                _buildPasswordField(),
                SizedBox(height: ThemeDimensions.spacingSmall),
                _buildForgotPassword(),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildSignInButton(),
                SizedBox(height: ThemeDimensions.spacingMedium),
                _buildSignUpLink(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogo() {
    return Column(
      children: [
        const WuyCommonLogo(),
        SizedBox(height: ThemeDimensions.spacingMedium),
        Text(
          'Welcome to Wuy App',
          style: ThemeTextStyles.displayMedium,
        ),
        Text(
          'Sign in to continue',
          style: ThemeTextStyles.bodyLarge.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildEmailField() {
    return TextFormField(
      controller: _emailController,
      keyboardType: TextInputType.emailAddress,
      decoration: InputDecoration(
        labelText: LocalizationKeysAppWuy.wuyLoginEmail.tr(context),
        hintText: LocalizationKeysAppWuy.wuyLoginEnterEmail.tr(context),
        prefixIcon: Icon(Icons.email, color: ThemeColors.primary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          borderSide: BorderSide(color: ThemeColors.primary, width: 2),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter your email';
        }
        if (!value.contains('@')) {
          return 'Please enter a valid email';
        }
        return null;
      },
    );
  }

  Widget _buildPasswordField() {
    return TextFormField(
      controller: _passwordController,
      obscureText: _obscurePassword,
      decoration: InputDecoration(
        labelText: LocalizationKeysAppWuy.wuyLoginPassword.tr(context),
        hintText: LocalizationKeysAppWuy.wuyLoginEnterPassword.tr(context),
        prefixIcon: Icon(Icons.lock, color: ThemeColors.primary),
        suffixIcon: IconButton(
          icon: Icon(
            _obscurePassword ? Icons.visibility : Icons.visibility_off,
            color: ThemeColors.textSecondary,
          ),
          onPressed: () {
            setState(() {
              _obscurePassword = !_obscurePassword;
            });
          },
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          borderSide: BorderSide(color: ThemeColors.primary, width: 2),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter your password';
        }
        if (value.length < 6) {
          return 'Password must be at least 6 characters';
        }
        return null;
      },
    );
  }

  Widget _buildForgotPassword() {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: () {
          // Handle forgot password
        },
        child: Text(
          'Forgot Password?',
          style: ThemeTextStyles.bodyMedium.copyWith(
            color: ThemeColors.primary,
          ),
        ),
      ),
    );
  }

  Widget _buildSignInButton() {
    return ElevatedButton(
      onPressed: _isLoading ? null : _handleSignIn,
      style: ElevatedButton.styleFrom(
        backgroundColor: ThemeColors.primary,
        minimumSize: Size(double.infinity, 50),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
      ),
      child: _isLoading
          ? CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.white),
            )
          : Text(
              LocalizationKeysAppWuy.wuyLoginSignIn.tr(context),
              style: ThemeTextStyles.buttonLarge,
            ),
    );
  }

  Widget _buildSignUpLink() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          LocalizationKeysAppWuy.wuyLoginDontHaveAccount.tr(context),
          style: ThemeTextStyles.bodyMedium,
        ),
        TextButton(
          onPressed: () {
            // Navigate to sign up
          },
          child: Text(
            LocalizationKeysAppWuy.wuyLoginSignUp.tr(context),
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  void _handleSignIn() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      try {
        // Create a mock user for login
        final mockUser = UserModelAppWuy(
          id: 1,
          username: _emailController.text.trim(),
          name: 'Wuy User',
          email: _emailController.text.trim(),
          phoneNumber: '+1234567890',
          isActive: true,
          isVerified: true,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );

        // Use auth state manager to handle login
        final authStateManager = WuyAuthStateManager.instance;
        await authStateManager.setAuthenticatedUser(mockUser);

        // Use AuthGuard to handle login success
        await AuthGuard.onLoginSuccess(context);

        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      } catch (e) {
        debugPrint('Login error: $e');
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
          
          // Show error message
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Login failed: ${e.toString()}'),
              backgroundColor: ThemeColors.error,
            ),
          );
        }
      }
    }
  }
}