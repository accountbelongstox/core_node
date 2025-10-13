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

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../services_app_wuy/wuy_data_manager.dart';
import '../../../utils_app_wuy/auth_guard.dart';
import '../../../../../common/utils/validation/phone_checker.dart';
import '../../../widgets_app_wuy/wuy_common_logo.dart';
import '../../../widgets_app_wuy/wuy_modern_input_field.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';

/// Login/Register Screen for Wuy App
///
/// This screen provides a unified interface for both login and registration.
/// Users can enter their phone number and verification code to access the app.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyPhoneLoginTitle.tr(context)
class WuyLoginRegisterScreen extends StatefulWidget {
  const WuyLoginRegisterScreen({super.key});

  @override
  State<WuyLoginRegisterScreen> createState() => _WuyLoginRegisterScreenState();
}

class _WuyLoginRegisterScreenState extends State<WuyLoginRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _verificationController = TextEditingController();
  bool _isLoading = false;
  bool _isRegisterMode = false; // Default to login mode
  bool _canSendCode = false;
  int _countdown = 0;
  final WuyDataManager _dataManager = WuyDataManager.instance;

  @override
  void dispose() {
    _phoneController.dispose();
    _verificationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: WuyAppThemeConfig.wuyBackgroundDecoration,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back,
                color: WuyAppThemeConfig.wuyTextPrimary),
            onPressed: () => context.pop(),
          ),
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(WuyAppThemeConfig.wuyDefaultPadding),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(height: WuyAppThemeConfig.wuyLargePadding * 2),
                  _buildTitle(),
                  SizedBox(height: WuyAppThemeConfig.wuyLargePadding),
                  _buildLogo(),
                  SizedBox(height: WuyAppThemeConfig.wuyLargePadding * 2),
                  _buildPhoneField(),
                  SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
                  _buildVerificationField(),
                  SizedBox(height: WuyAppThemeConfig.wuyLargePadding),
                  _buildActionButton(),
                  SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
                  _buildModeToggle(),
                  SizedBox(height: WuyAppThemeConfig.wuyLargePadding * 2),
                  _buildUserAgreement(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTitle() {
    return Text(
      LocalizationKeysAppWuy.wuyPhoneLoginTitle.tr(context),
      style: ThemeTextStyles.title1Bold.copyWith(
        color: WuyAppThemeConfig.wuyTextPrimary,
        fontSize: 28,
        fontWeight: FontWeight.bold,
      ),
      textAlign: TextAlign.center,
    );
  }

  Widget _buildLogo() {
    return const WuyCommonLogo();
  }

  Widget _buildPhoneField() {
    return WuyModernInputField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      hintText: LocalizationKeysAppWuy.wuyEnterPhoneNumber.tr(context),
      borderRadius: 12.0,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return LocalizationKeysAppWuy.wuyValidationPhoneRequired.tr(context);
        }
        if (!PhoneChecker.isValidPhone(value)) {
          return LocalizationKeysAppWuy.wuyValidationPhoneFormat.tr(context);
        }
        return null;
      },
      onChanged: (value) {
        setState(() {
          _canSendCode = PhoneChecker.isValidPhone(value);
        });
      },
    );
  }

  Widget _buildVerificationField() {
    return WuyModernInputField(
      controller: _verificationController,
      keyboardType: TextInputType.number,
      hintText: LocalizationKeysAppWuy.wuyVerificationCode.tr(context),
      borderRadius: 12.0,
      suffixIcon: TextButton(
        onPressed: (_isLoading || !_canSendCode || _countdown > 0)
            ? null
            : _sendVerificationCode,
        child: Text(
          _countdown > 0
              ? '${_countdown}s'
              : LocalizationKeysAppWuy.wuyGetCode.tr(context),
          style: ThemeTextStyles.buttonSmall.copyWith(
            color: (_canSendCode && _countdown == 0)
                ? WuyAppThemeConfig.wuyPrimaryColor
                : WuyAppThemeConfig.wuyTextSub,
            fontSize: 14,
          ),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return LocalizationKeysAppWuy.wuyValidationVerificationRequired
              .tr(context);
        }
        if (value.length < 4) {
          return LocalizationKeysAppWuy.wuyValidationVerificationFormat
              .tr(context);
        }
        return null;
      },
    );
  }

  Widget _buildActionButton() {
    return WuyGradientButton(
      text: _isRegisterMode
          ? LocalizationKeysAppWuy.wuyRegisterLogin.tr(context)
          : LocalizationKeysAppWuy.wuyLogin.tr(context),
      onPressed: _isLoading ? null : _handleAction,
      isLoading: _isLoading,
      height: 50,
      borderRadius: 25.0, // 50% of height (50/2 = 25)
      textColor: Colors.white,
    );
  }

  Widget _buildModeToggle() {
    return Center(
      child: TextButton(
        onPressed: () {
          setState(() {
            _isRegisterMode = !_isRegisterMode;
            // Clear form when switching modes
            _phoneController.clear();
            _verificationController.clear();
            _canSendCode = false;
            _countdown = 0;
          });
        },
        child: Text(
          _isRegisterMode
              ? LocalizationKeysAppWuy.wuyAlreadyHaveAccount.tr(context)
              : LocalizationKeysAppWuy.wuyNeedAccount.tr(context),
          style: ThemeTextStyles.buttonSmall.copyWith(
            color: WuyAppThemeConfig.wuyPrimaryColor,
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  Widget _buildUserAgreement() {
    return Padding(
      padding:
          EdgeInsets.symmetric(horizontal: WuyAppThemeConfig.wuyDefaultPadding),
      child: RichText(
        textAlign: TextAlign.center,
        text: TextSpan(
          style: ThemeTextStyles.caption1.copyWith(
            color: WuyAppThemeConfig.wuyTextSecondary,
            fontSize: 12,
          ),
          children: [
            TextSpan(text: LocalizationKeysAppWuy.wuyAgreementText.tr(context)),
            TextSpan(
              text: LocalizationKeysAppWuy.wuyUserAgreement.tr(context),
              style: TextStyle(
                color: WuyAppThemeConfig.wuyPrimaryColor,
                decoration: TextDecoration.underline,
              ),
            ),
            TextSpan(text: LocalizationKeysAppWuy.wuyAnd.tr(context)),
            TextSpan(
              text: LocalizationKeysAppWuy.wuyPrivacyPolicy.tr(context),
              style: TextStyle(
                color: WuyAppThemeConfig.wuyPrimaryColor,
                decoration: TextDecoration.underline,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _sendVerificationCode() async {
    final phone = _phoneController.text.trim();

    if (!PhoneChecker.isValidPhone(phone)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(LocalizationKeysAppWuy.wuyValidationPhoneFormat.tr(context)),
          backgroundColor: WuyAppThemeConfig.wuyErrorColor,
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final result = await _dataManager.sendVerificationCode(phone);

      if (result.isSuccess) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result.message),
              backgroundColor: WuyAppThemeConfig.wuySuccessColor,
            ),
          );
          // Start countdown
          _startCountdown();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result.error ??
                  LocalizationKeysAppWuy.wuyMessageSendCodeFailed.tr(context)),
              backgroundColor: WuyAppThemeConfig.wuyErrorColor,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(LocalizationKeysAppWuy.wuyMessageSendCodeError
                .tr(context, ['$e'])),
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

  void _startCountdown() {
    setState(() {
      _countdown = 60;
    });

    Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _countdown--;
        });

        if (_countdown <= 0) {
          timer.cancel();
        }
      } else {
        timer.cancel();
      }
    });
  }

  void _handleAction() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      try {
        final phone = _phoneController.text.trim();
        final verificationCode = _verificationController.text.trim();

        AuthResult result;
        if (_isRegisterMode) {
          result = await _dataManager.registerWithPhone(
            phone: phone,
            verificationCode: verificationCode,
          );
        } else {
          result = await _dataManager.loginWithPhone(
            phone: phone,
            verificationCode: verificationCode,
          );
        }

        if (result.isSuccess) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(result.message),
                backgroundColor: WuyAppThemeConfig.wuySuccessColor,
              ),
            );
            // Navigate to friends list using AuthGuard method with proper async handling
            await AuthGuard.onLoginSuccess(context);
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(result.error ??
                    LocalizationKeysAppWuy.wuyMessageOperationFailed
                        .tr(context)),
                backgroundColor: WuyAppThemeConfig.wuyErrorColor,
              ),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(LocalizationKeysAppWuy.wuyMessageLoginFailed
                  .tr(context, ['$e'])),
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
}
