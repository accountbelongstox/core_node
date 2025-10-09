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
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../services_app_wuy/wuy_data_center.dart';
import '../../../services_app_wuy/wuy_network_manager.dart';

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
    return Scaffold(
      body: Container(
        decoration: WuyAppThemeConfig.wuyBackgroundDecoration,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            title: Text(
              LocalizationKeysAppWuy.wuyPhoneLoginTitle.tr(context),
              style: WuyAppThemeConfig.wuyAppBarTitle,
            ),
            backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
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
                ],
              ),
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
    return TextFormField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      decoration: InputDecoration(
        labelText: LocalizationKeysAppWuy.wuyEnterPhoneNumber.tr(context),
        hintText: '138****8888',
        prefixIcon: Icon(Icons.phone, color: WuyAppThemeConfig.wuyPrimaryColor),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WuyAppThemeConfig.wuyBorderRadius),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WuyAppThemeConfig.wuyBorderRadius),
          borderSide: BorderSide(color: WuyAppThemeConfig.wuyPrimaryColor, width: 2),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return LocalizationKeysAppWuy.wuyValidationRequired.tr(context);
        }
        if (value.length < 11) {
          return '请输入有效的手机号';
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
        labelText: LocalizationKeysAppWuy.wuyEnterPassword.tr(context),
        hintText: '请输入密码',
        prefixIcon: Icon(Icons.lock, color: WuyAppThemeConfig.wuyPrimaryColor),
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
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WuyAppThemeConfig.wuyBorderRadius),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WuyAppThemeConfig.wuyBorderRadius),
          borderSide: BorderSide(color: WuyAppThemeConfig.wuyPrimaryColor, width: 2),
        ),
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
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handleLogin,
        style: WuyAppThemeConfig.wuyPrimaryButton,
        child: _isLoading
            ? CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              )
            : Text(
                LocalizationKeysAppWuy.wuyLoginButton.tr(context),
                style: ThemeTextStyles.buttonLarge.copyWith(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }

  Widget _buildRegisterButton() {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: OutlinedButton(
        onPressed: _isLoading ? null : _handleRegister,
        style: WuyAppThemeConfig.wuySecondaryButton,
        child: Text(
          LocalizationKeysAppWuy.wuyRegisterButton.tr(context),
          style: ThemeTextStyles.buttonLarge.copyWith(
            color: WuyAppThemeConfig.wuyPrimaryColor,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  void _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      try {
        // Check if we should use offline mode
        final networkManager = WuyNetworkManager();
        final shouldUseOffline = networkManager.shouldUseOfflineMode();

        if (shouldUseOffline) {
          // Use fake data for offline mode
          await _handleOfflineLogin();
        } else {
          // Use real API for online mode
          await _handleOnlineLogin();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('登录失败: $e'),
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

    // Generate fake user data
    final dataCenter = Provider.of<WuyDataCenter>(context, listen: false);
    await dataCenter.loginWithFakeData(
      phone: _phoneController.text,
      password: _passwordController.text,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('登录成功 (离线模式)'),
          backgroundColor: WuyAppThemeConfig.wuySuccessColor,
        ),
      );

      // Navigate to friends list
      context.go(WuyAppRouter.routeFriends);
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
