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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';

/// Register Screen for Wuy App
/// 
/// This screen provides user registration functionality.
/// 
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyRegisterTitle.tr(context)
class WuyRegisterScreen extends StatefulWidget {
  const WuyRegisterScreen({super.key});

  @override
  State<WuyRegisterScreen> createState() => _WuyRegisterScreenState();
}

class _WuyRegisterScreenState extends State<WuyRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _verificationCodeController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  int _countdown = 0;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _verificationCodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: WuyAppThemeConfig.wuyBackgroundDecoration,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            title: Text(
              LocalizationKeysAppWuy.wuyRegisterTitle.tr(context),
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
                  _buildPhoneField(),
                  SizedBox(height: ThemeDimensions.spacingMedium),
                  _buildVerificationCodeField(),
                  SizedBox(height: ThemeDimensions.spacingMedium),
                  _buildPasswordField(),
                  SizedBox(height: ThemeDimensions.spacingMedium),
                  _buildConfirmPasswordField(),
                  SizedBox(height: ThemeDimensions.spacingLarge),
                  _buildRegisterButton(),
                  SizedBox(height: ThemeDimensions.spacingMedium),
                  _buildSignInLink(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogo() {
    return Column(
      children: [
        Icon(
          Icons.apps,
          size: 80,
          color: ThemeColors.primary,
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        Text(
          LocalizationKeysAppWuy.wuyRegisterTitle.tr(context),
          style: ThemeTextStyles.displayMedium,
        ),
        Text(
          LocalizationKeysAppWuy.wuyRegisterSubtitle.tr(context),
          style: ThemeTextStyles.bodyLarge.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField() {
    return TextFormField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      decoration: InputDecoration(
        labelText: LocalizationKeysAppWuy.wuyAuthPhone.tr(context),
        hintText: LocalizationKeysAppWuy.wuyRegisterEnterPhone.tr(context),
        prefixIcon: Icon(Icons.phone, color: ThemeColors.primary),
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
          return 'Please enter your phone number';
        }
        if (value.length < 10) {
          return 'Please enter a valid phone number';
        }
        return null;
      },
    );
  }

  Widget _buildVerificationCodeField() {
    return Row(
      children: [
        Expanded(
          child: TextFormField(
            controller: _verificationCodeController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Verification Code',
              hintText: LocalizationKeysAppWuy.wuyRegisterEnterVerificationCode.tr(context),
              prefixIcon: Icon(Icons.security, color: ThemeColors.primary),
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
                return 'Please enter verification code';
              }
              if (value.length != 6) {
                return 'Verification code must be 6 digits';
              }
              return null;
            },
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingMedium),
        SizedBox(
          width: 120,
          child: ElevatedButton(
            onPressed: _countdown > 0 ? null : _sendVerificationCode,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
              ),
            ),
            child: Text(
              _countdown > 0 ? '${_countdown}s' : 'Send Code',
              style: ThemeTextStyles.buttonMedium,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordField() {
    return TextFormField(
      controller: _passwordController,
      obscureText: _obscurePassword,
      decoration: InputDecoration(
        labelText: 'Password',
        hintText: 'Enter your password',
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

  Widget _buildConfirmPasswordField() {
    return TextFormField(
      controller: _confirmPasswordController,
      obscureText: _obscureConfirmPassword,
      decoration: InputDecoration(
        labelText: 'Confirm Password',
        hintText: 'Confirm your password',
        prefixIcon: Icon(Icons.lock_outline, color: ThemeColors.primary),
        suffixIcon: IconButton(
          icon: Icon(
            _obscureConfirmPassword ? Icons.visibility : Icons.visibility_off,
            color: ThemeColors.textSecondary,
          ),
          onPressed: () {
            setState(() {
              _obscureConfirmPassword = !_obscureConfirmPassword;
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
          return 'Please confirm your password';
        }
        if (value != _passwordController.text) {
          return 'Passwords do not match';
        }
        return null;
      },
    );
  }

  Widget _buildRegisterButton() {
    return ElevatedButton(
      onPressed: _isLoading ? null : _handleRegister,
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
              'Register',
              style: ThemeTextStyles.buttonLarge,
            ),
    );
  }

  Widget _buildSignInLink() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          "Already have an account? ",
          style: ThemeTextStyles.bodyMedium,
        ),
        TextButton(
          onPressed: () {
            context.go(WuyAppRouter.routeLogin);
          },
          child: Text(
            'Sign In',
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  void _sendVerificationCode() async {
    if (_phoneController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(LocalizationKeysAppWuy.wuyMessageEnterPhoneFirst.tr(context))),
      );
      return;
    }

    setState(() {
      _countdown = 60;
    });

    // Start countdown
    _startCountdown();

    // Simulate sending verification code
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(LocalizationKeysAppWuy.wuyMessageVerificationCodeSent.tr(context, [_phoneController.text]))),
    );
  }

  void _startCountdown() {
    Future.delayed(Duration(seconds: 1), () {
      if (mounted && _countdown > 0) {
        setState(() {
          _countdown--;
        });
        _startCountdown();
      }
    });
  }

  void _handleRegister() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      // Simulate registration
      await Future.delayed(const Duration(seconds: 2));

      setState(() {
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(LocalizationKeysAppWuy.wuyMessageRegistrationSuccessful.tr(context))),
        );
        context.go(WuyAppRouter.routeHome);
      }
    }
  }
}
