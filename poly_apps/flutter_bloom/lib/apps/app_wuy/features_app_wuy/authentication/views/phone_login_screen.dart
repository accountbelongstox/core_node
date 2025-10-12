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
// Provider import removed as WuyDataCenter was deleted
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
// WuyDataCenter functionality merged into WuyUnifiedService
import '../../../services_app_wuy/wuy_unified_service.dart';
import '../../../widgets_app_wuy/wuy_background_decoration.dart';
import '../../../widgets_app_wuy/wuy_modern_input_field.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';

/// Phone Login Screen for Wuy App
/// 
/// This screen provides phone number based login functionality.
/// 
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyPhoneLoginTitle.tr(context)
class WuyPhoneLoginScreen extends StatefulWidget {
  const WuyPhoneLoginScreen({super.key});

  @override
  State<WuyPhoneLoginScreen> createState() => _WuyPhoneLoginScreenState();
}

class _WuyPhoneLoginScreenState extends State<WuyPhoneLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return WuyBackgroundDecoration(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: Text(
            LocalizationKeysAppWuy.wuyPhoneLoginTitle.tr(context),
            style: WuyAppThemeConfig.wuyAppBarTitle,
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: WuyAppThemeConfig.wuyTextPrimary),
            onPressed: () => context.pop(),
          ),
        ),
        body: SingleChildScrollView(
          padding: EdgeInsets.all(WuyAppThemeConfig.wuyDefaultPadding),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: WuyAppThemeConfig.wuyLargePadding),
                _buildLogo(),
                SizedBox(height: WuyAppThemeConfig.wuyLargePadding * 2),
                _buildPhoneField(),
                SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
                _buildPasswordField(),
                SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
                _buildLoginButton(),
                SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
                _buildRegisterButton(),
                SizedBox(height: WuyAppThemeConfig.wuyLargePadding),
                _buildUserAgreement(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogo() {
    return Center(
      child: Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: WuyAppThemeConfig.wuyPrimaryColor,
          borderRadius: BorderRadius.circular(WuyAppThemeConfig.wuyCardBorderRadius),
          boxShadow: WuyAppThemeConfig.wuyCardShadow,
        ),
        child: Icon(
          Icons.phone_android,
          color: Colors.white,
          size: 40,
        ),
      ),
    );
  }

  Widget _buildPhoneField() {
    return WuyModernInputField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      hintText: LocalizationKeysAppWuy.wuyEnterPhoneNumber.tr(context),
      prefixIcon: Icons.phone,
      borderRadius: 12.0,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return LocalizationKeysAppWuy.wuyValidationRequired.tr(context);
        }
        if (value.length < 11) {
          return LocalizationKeysAppWuy.wuyValidationPhoneInvalid.tr(context);
        }
        return null;
      },
    );
  }

  Widget _buildPasswordField() {
    return WuyModernInputField(
      controller: _passwordController,
      obscureText: _obscurePassword,
      hintText: LocalizationKeysAppWuy.wuyEnterPassword.tr(context),
      prefixIcon: Icons.lock,
      borderRadius: 12.0,
      suffixIcon: IconButton(
        icon: Icon(
          _obscurePassword ? Icons.visibility : Icons.visibility_off,
          color: WuyAppThemeConfig.wuyTextSecondary,
        ),
        onPressed: () {
          setState(() {
            _obscurePassword = !_obscurePassword;
          });
        },
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return LocalizationKeysAppWuy.wuyValidationRequired.tr(context);
        }
        if (value.length < 6) {
          return LocalizationKeysAppWuy.wuyValidationPasswordTooShort.tr(context);
        }
        return null;
      },
    );
  }

  Widget _buildLoginButton() {
    return WuyGradientButton(
      text: LocalizationKeysAppWuy.wuyLoginButton.tr(context),
      onPressed: _isLoading ? null : _handleLogin,
      isLoading: _isLoading,
      height: 50,
      borderRadius: 12.0,
    );
  }

  Widget _buildRegisterButton() {
    return WuyGradientButton(
      text: LocalizationKeysAppWuy.wuyRegisterButton.tr(context),
      onPressed: _isLoading ? null : _handleRegister,
      isLoading: false,
      height: 50,
      borderRadius: 12.0,
      gradientColors: [
        WuyAppThemeConfig.wuyGradientStart,
        WuyAppThemeConfig.wuyGradientMiddle,
      ],
    );
  }

  Widget _buildUserAgreement() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: WuyAppThemeConfig.wuyDefaultPadding),
      child: Text(
        LocalizationKeysAppWuy.wuyUserAgreement.tr(context),
        style: ThemeTextStyles.caption1.copyWith(
          color: WuyAppThemeConfig.wuyTextSecondary,
          fontSize: 12,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  void _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      try {
        // Always use online mode for now
        await _handleOnlineLogin();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(LocalizationKeysAppWuy.wuyMessageLoginFailed.tr(context, ['$e'])),
              backgroundColor: WuyAppThemeConfig.wuyErrorColor,
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }
    }
  }

  void _handleRegister() {
    context.go(WuyAppRouter.routeRegister);
  }

  Future<void> _handleOfflineLogin() async {
    // Simulate network delay
    await Future.delayed(const Duration(seconds: 1));

    // Generate fake user data using unified service
    final unifiedService = WuyUnifiedService();
    await unifiedService.loginWithPhone(
      phone: _phoneController.text,
      verificationCode: '123456', // Mock verification code
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(LocalizationKeysAppWuy.wuyMessageLoginSuccessOffline.tr(context)),
          backgroundColor: WuyAppThemeConfig.wuySuccessColor,
        ),
      );

      // Navigate to friends list
      context.go(WuyAppRouter.routeHome);
    }
  }

  Future<void> _handleOnlineLogin() async {
    // Simulate API call
    await Future.delayed(const Duration(seconds: 2));

    // For now, use fake data even in online mode
    // In real implementation, this would call the actual API
    await _handleOfflineLogin();
  }
}
