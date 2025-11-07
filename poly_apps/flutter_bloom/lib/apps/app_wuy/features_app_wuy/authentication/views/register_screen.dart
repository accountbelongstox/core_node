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
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_modern_input_field.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';

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
              style: ThemeTextStyles.displayMedium.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            backgroundColor: ThemeColors.primary,
            elevation: 0,
            centerTitle: true,
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 12),
                  _buildLogo(),
                  const SizedBox(height: 36),
                  _buildPhoneField(),
                  const SizedBox(height: 16),
                  _buildVerificationCodeField(),
                  const SizedBox(height: 16),
                  _buildPasswordField(),
                  const SizedBox(height: 16),
                  _buildConfirmPasswordField(),
                  const SizedBox(height: 32),
                  _buildRegisterButton(),
                  const SizedBox(height: 20),
                  _buildSignInLink(),
                  const SizedBox(height: 20),
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
        Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                ThemeColors.primary,
                ThemeColors.accent,
              ],
            ),
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: ThemeColors.primary.withOpacity(0.3),
                blurRadius: 18,
                offset: const Offset(0, 8),
                spreadRadius: 0,
              ),
              BoxShadow(
                color: ThemeColors.accent.withOpacity(0.2),
                blurRadius: 28,
                offset: const Offset(0, 12),
                spreadRadius: -5,
              ),
            ],
          ),
          child: const Icon(
            Icons.apps,
            size: 44,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 18),
        Text(
          LocalizationKeysAppWuy.wuyRegisterTitle.tr(context),
          style: ThemeTextStyles.displayMedium.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 24,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          LocalizationKeysAppWuy.wuyRegisterSubtitle.tr(context),
          style: ThemeTextStyles.bodyLarge.copyWith(
            color: ThemeColors.textSecondary.withOpacity(0.8),
            fontSize: 14,
            letterSpacing: 0.2,
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField() {
    return WuyModernInputField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      labelText: LocalizationKeysAppWuy.wuyAuthPhone.tr(context),
      hintText: LocalizationKeysAppWuy.wuyRegisterEnterPhone.tr(context),
      prefixIcon: Icons.phone,
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: WuyModernInputField(
            controller: _verificationCodeController,
            keyboardType: TextInputType.number,
            labelText: 'Verification Code',
            hintText: LocalizationKeysAppWuy.wuyRegisterEnterVerificationCode.tr(context),
            prefixIcon: Icons.security,
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
        const SizedBox(width: 12),
        Container(
          width: 110,
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: _countdown > 0
                ? null
                : LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      ThemeColors.primary,
                      ThemeColors.accent,
                    ],
                  ),
            color: _countdown > 0 ? ThemeColors.textSecondary.withOpacity(0.2) : null,
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: _countdown > 0 ? null : _sendVerificationCode,
              child: Center(
                child: Text(
                  _countdown > 0 ? '${_countdown}s' : LocalizationKeysAppWuy.wuyRegisterSend.tr(context),
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordField() {
    return WuyModernInputField(
      controller: _passwordController,
      obscureText: _obscurePassword,
      labelText: LocalizationKeysAppWuy.wuyRegisterPassword.tr(context),
      hintText: LocalizationKeysAppWuy.wuyRegisterPasswordHint.tr(context),
      prefixIcon: Icons.lock,
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
      validator: (value) {
        if (value == null || value.isEmpty) {
          return LocalizationKeysAppWuy.wuyRegisterPasswordValidation.tr(context);
        }
        if (value.length < 6) {
          return LocalizationKeysAppWuy.wuyRegisterPasswordLengthValidation.tr(context);
        }
        return null;
      },
    );
  }

  Widget _buildConfirmPasswordField() {
    return WuyModernInputField(
      controller: _confirmPasswordController,
      obscureText: _obscureConfirmPassword,
      labelText: LocalizationKeysAppWuy.wuyRegisterConfirmPassword.tr(context),
      hintText: LocalizationKeysAppWuy.wuyRegisterConfirmPasswordHint.tr(context),
      prefixIcon: Icons.lock_outline,
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
      validator: (value) {
        if (value == null || value.isEmpty) {
          return LocalizationKeysAppWuy.wuyRegisterConfirmPasswordValidation.tr(context);
        }
        if (value != _passwordController.text) {
          return LocalizationKeysAppWuy.wuyRegisterPasswordMismatch.tr(context);
        }
        return null;
      },
    );
  }

  Widget _buildRegisterButton() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.primary.withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: ThemeColors.accent.withOpacity(0.15),
            blurRadius: 24,
            offset: const Offset(0, 10),
            spreadRadius: -4,
          ),
        ],
      ),
      child: WuyGradientButton(
        text: LocalizationKeysAppWuy.wuyRegisterNow.tr(context),
        onPressed: _handleRegister,
        isLoading: _isLoading,
        height: 54,
        borderRadius: 28.0,
        fontSize: 17,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _buildSignInLink() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          LocalizationKeysAppWuy.wuyRegisterHaveAccount.tr(context),
          style: ThemeTextStyles.bodyMedium.copyWith(
            fontSize: 14,
            color: ThemeColors.textSecondary.withOpacity(0.9),
            letterSpacing: 0.1,
          ),
        ),
        TextButton(
          onPressed: () {
            context.go(WuyAppRouter.routeLogin);
          },
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text(
            'Sign In',
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.primary,
              fontWeight: FontWeight.w700,
              fontSize: 14,
              letterSpacing: 0.1,
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
