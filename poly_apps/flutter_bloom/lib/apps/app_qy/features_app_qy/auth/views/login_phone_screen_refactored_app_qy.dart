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

/// Refactored Login Phone Screen for QY App - with proper architecture
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/auth_controller_app_qy.dart';

class LoginPhoneScreenRefactoredAppQy extends StatefulWidget {
  const LoginPhoneScreenRefactoredAppQy({super.key});

  @override
  State<LoginPhoneScreenRefactoredAppQy> createState() =>
      _LoginPhoneScreenRefactoredAppQyState();
}

class _LoginPhoneScreenRefactoredAppQyState
    extends State<LoginPhoneScreenRefactoredAppQy> {
  final TextEditingController _phoneController;
  final TextEditingController _codeController;
  bool _showCodeInput;

  _LoginPhoneScreenRefactoredAppQyState()
      : _phoneController = TextEditingController(),
        _codeController = TextEditingController(),
        _showCodeInput = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _handleSendCode() {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      _showError(QyAppLocalizationKeys.qyPleaseEnterPhone.tr(context));
      return;
    }

    context.read<AuthControllerAppQy>().sendVerificationCode(phone).then((success) {
      if (success) {
        setState(() {
          _showCodeInput = true;
        });
      }
    });
  }

  void _handleLogin() {
    final controller = context.read<AuthControllerAppQy>();

    if (!controller.agreedToTerms) {
      _showError(QyAppLocalizationKeys.qyPleaseAgreeTerms.tr(context));
      return;
    }

    final phone = _phoneController.text.trim();
    final code = _codeController.text.trim();

    if (phone.isEmpty || code.isEmpty) {
      _showError(QyAppLocalizationKeys.qyPleaseCompleteForm.tr(context));
      return;
    }

    controller.loginWithPhone(
      phoneNumber: phone,
      verificationCode: code,
    ).then((success) {
      if (success) {
        Navigator.of(context).pushReplacementNamed('/home');
      }
    });
  }

  void _handleSocialLogin(String method) {
    final controller = context.read<AuthControllerAppQy>();

    if (!controller.agreedToTerms) {
      _showError(QyAppLocalizationKeys.qyPleaseAgreeTerms.tr(context));
      return;
    }

    switch (method) {
      case 'wechat':
        controller.loginWithWechat();
        break;
      case 'weibo':
        controller.loginWithWeibo();
        break;
      case 'qq':
        controller.loginWithQQ();
        break;
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      body: Consumer<AuthControllerAppQy>(
        builder: (context, controller, child) {
          return SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(Dimensions.paddingLarge),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: Dimensions.spacingXLarge * 3),
                  _buildHeader(),
                  SizedBox(height: Dimensions.spacingXLarge * 2),
                  _buildPhoneInput(controller),
                  if (_showCodeInput) ...[
                    SizedBox(height: Dimensions.spacingLarge),
                    _buildCodeInput(controller),
                  ],
                  SizedBox(height: Dimensions.spacingLarge),
                  _buildTermsCheckbox(controller),
                  SizedBox(height: Dimensions.spacingLarge),
                  _buildLoginButton(controller),
                  SizedBox(height: Dimensions.spacingXLarge),
                  _buildSocialLogins(),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Every word',
          style: TextStyles.display1.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 48,
          ),
        ),
        Text(
          'counts here',
          style: TextStyles.display1.copyWith(
            color: ThemeColors.textSecondary,
            fontSize: 40,
          ),
        ),
        SizedBox(height: Dimensions.spacingLarge),
        Text(
          QyAppLocalizationKeys.qyAppName.tr(context),
          style: TextStyles.h2.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Text(
          QyAppLocalizationKeys.qyAppSlogan.tr(context),
          style: TextStyles.body1.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneInput(AuthControllerAppQy controller) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: Dimensions.paddingMedium,
        vertical: Dimensions.paddingSmall,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        children: [
          Icon(Icons.phone, color: ThemeColors.textSecondary),
          SizedBox(width: Dimensions.spacingSmall),
          Expanded(
            child: TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                hintText: QyAppLocalizationKeys.qyEnterPhone.tr(context),
                hintStyle: TextStyles.body1.copyWith(
                  color: ThemeColors.textTertiary,
                ),
                border: InputBorder.none,
              ),
              style: TextStyles.body1.copyWith(
                color: ThemeColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCodeInput(AuthControllerAppQy controller) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: Dimensions.paddingMedium,
        vertical: Dimensions.paddingSmall,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        children: [
          Icon(Icons.lock_outline, color: ThemeColors.textSecondary),
          SizedBox(width: Dimensions.spacingSmall),
          Expanded(
            child: TextField(
              controller: _codeController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: QyAppLocalizationKeys.qyEnterCode.tr(context),
                hintStyle: TextStyles.body1.copyWith(
                  color: ThemeColors.textTertiary,
                ),
                border: InputBorder.none,
              ),
              style: TextStyles.body1.copyWith(
                color: ThemeColors.textPrimary,
              ),
            ),
          ),
          TextButton(
            onPressed: controller.canSendCode ? _handleSendCode : null,
            child: Text(
              controller.canSendCode
                  ? QyAppLocalizationKeys.qySendCode.tr(context)
                  : '${controller.countdown}s',
              style: TextStyles.button.copyWith(
                color: controller.canSendCode
                    ? ThemeColors.primary
                    : ThemeColors.textTertiary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTermsCheckbox(AuthControllerAppQy controller) {
    return Row(
      children: [
        Checkbox(
          value: controller.agreedToTerms,
          onChanged: (value) {
            controller.setAgreedToTerms(value ?? false);
          },
          activeColor: ThemeColors.primary,
        ),
        Expanded(
          child: GestureDetector(
            onTap: () {
              controller.setAgreedToTerms(!controller.agreedToTerms);
            },
            child: RichText(
              text: TextSpan(
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.textSecondary,
                ),
                children: [
                  TextSpan(
                    text: QyAppLocalizationKeys.qyAgreeToTermsPrefix.tr(context),
                  ),
                  TextSpan(
                    text: QyAppLocalizationKeys.qyUserAgreement.tr(context),
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.primary,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                  TextSpan(
                    text: QyAppLocalizationKeys.qyAnd.tr(context),
                  ),
                  TextSpan(
                    text: QyAppLocalizationKeys.qyPrivacyPolicy.tr(context),
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.primary,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLoginButton(AuthControllerAppQy controller) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: controller.isLoading
            ? null
            : (_showCodeInput ? _handleLogin : _handleSendCode),
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeColors.primary,
          disabledBackgroundColor: ThemeColors.primary.withOpacity(0.5),
          padding: EdgeInsets.symmetric(vertical: Dimensions.paddingMedium),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          ),
        ),
        child: controller.isLoading
            ? SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.surface),
                ),
              )
            : Text(
                _showCodeInput
                    ? QyAppLocalizationKeys.qyLogin.tr(context)
                    : QyAppLocalizationKeys.qyGetCode.tr(context),
                style: TextStyles.button.copyWith(
                  color: ThemeColors.surface,
                  fontWeight: FontWeight.bold,
                ),
              ),
      ),
    );
  }

  Widget _buildSocialLogins() {
    return Column(
      children: [
        Text(
          QyAppLocalizationKeys.qyOtherLoginMethods.tr(context),
          style: TextStyles.caption.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildSocialButton(
              icon: Icons.wechat,
              label: QyAppLocalizationKeys.qyWechat.tr(context),
              color: const Color(0xFF07C160),
              onTap: () => _handleSocialLogin('wechat'),
            ),
            _buildSocialButton(
              icon: Icons.shield,
              label: QyAppLocalizationKeys.qyQyAccount.tr(context),
              color: ThemeColors.primary,
              onTap: () {},
            ),
            _buildSocialButton(
              icon: Icons.message,
              label: QyAppLocalizationKeys.qyWeibo.tr(context),
              color: const Color(0xFFE6162D),
              onTap: () => _handleSocialLogin('weibo'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSocialButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        width: 80,
        padding: EdgeInsets.all(Dimensions.paddingSmall),
        child: Column(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: color,
                size: 24,
              ),
            ),
            SizedBox(height: Dimensions.spacingXSmall),
            Text(
              label,
              style: TextStyles.caption.copyWith(
                color: ThemeColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
