// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Login Phone Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class LoginPhoneScreenAppQy extends StatefulWidget {
  const LoginPhoneScreenAppQy({super.key});

  @override
  State<LoginPhoneScreenAppQy> createState() => _LoginPhoneScreenAppQyState();
}

class _LoginPhoneScreenAppQyState extends State<LoginPhoneScreenAppQy> {
  final TextEditingController _phoneController;
  final TextEditingController _codeController;
  bool _agreedToTerms;
  bool _showCodeInput;
  int _countdown;

  _LoginPhoneScreenAppQyState()
      : _phoneController = TextEditingController(),
        _codeController = TextEditingController(),
        _agreedToTerms = false,
        _showCodeInput = false,
        _countdown = 0;

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _handlePhoneLogin() {
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(QyAppLocalizationKeys.qyAuthMustAgree.tr(context)),
          backgroundColor: ThemeColors.error,
        ),
      );
      return;
    }
    // TODO: Implement phone login logic
  }

  void _handleWechatLogin() {
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(QyAppLocalizationKeys.qyAuthMustAgree.tr(context)),
          backgroundColor: ThemeColors.error,
        ),
      );
      return;
    }
    // TODO: Implement WeChat login logic
  }

  void _handleAccountLogin() {
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(QyAppLocalizationKeys.qyAuthMustAgree.tr(context)),
          backgroundColor: ThemeColors.error,
        ),
      );
      return;
    }
    // TODO: Implement QY account login logic
  }

  void _handleWeiboLogin() {
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(QyAppLocalizationKeys.qyAuthMustAgree.tr(context)),
          backgroundColor: ThemeColors.error,
        ),
      );
      return;
    }
    // TODO: Implement Weibo login logic
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(Dimensions.paddingLarge),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(height: Dimensions.spacingXLarge * 2),
              _buildHeader(),
              SizedBox(height: Dimensions.spacingXLarge * 2),
              _buildPhoneLoginSection(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildWechatLoginButton(),
              SizedBox(height: Dimensions.spacingXLarge * 2),
              _buildAlternativeLogins(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildAgreementSection(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        Text(
          QyAppLocalizationKeys.qyLoginSlogan1.tr(context),
          style: TextStyles.h1.copyWith(
            color: ThemeColors.textPrimary,
            fontSize: 48,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          QyAppLocalizationKeys.qyLoginSlogan2.tr(context),
          style: TextStyles.h1.copyWith(
            color: ThemeColors.textPrimary,
            fontSize: 48,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Text(
          QyAppLocalizationKeys.qyAppName.tr(context),
          style: TextStyles.h3.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Text(
          QyAppLocalizationKeys.qyLoginRememberWords.tr(context),
          style: TextStyles.body2.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneLoginSection() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(
          color: ThemeColors.primary,
          width: 2,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.phone_android,
            color: ThemeColors.primary,
            size: 24,
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Expanded(
            child: Text(
              QyAppLocalizationKeys.qyLoginByPhone.tr(context),
              style: TextStyles.button.copyWith(
                color: ThemeColors.primary,
              ),
            ),
          ),
          Icon(
            Icons.arrow_forward_ios,
            color: ThemeColors.primary,
            size: 16,
          ),
        ],
      ),
    );
  }

  Widget _buildWechatLoginButton() {
    return InkWell(
      onTap: _handleWechatLogin,
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(
            color: ThemeColors.border,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.wechat,
              color: ThemeColors.success,
              size: 24,
            ),
            SizedBox(width: Dimensions.spacingSmall),
            Text(
              QyAppLocalizationKeys.qyLoginByWechat.tr(context),
              style: TextStyles.button.copyWith(
                color: ThemeColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlternativeLogins() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildAlternativeLoginButton(
          QyAppLocalizationKeys.qyLoginByAccount.tr(context),
          Icons.account_circle,
          _handleAccountLogin,
        ),
        SizedBox(width: Dimensions.spacingLarge),
        _buildAlternativeLoginButton(
          QyAppLocalizationKeys.qyLoginByWeibo.tr(context),
          Icons.public,
          _handleWeiboLogin,
        ),
      ],
    );
  }

  Widget _buildAlternativeLoginButton(
    String text,
    IconData icon,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: Dimensions.paddingMedium,
          vertical: Dimensions.paddingSmall,
        ),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
          border: Border.all(
            color: ThemeColors.border,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: ThemeColors.textSecondary,
              size: 20,
            ),
            SizedBox(width: Dimensions.spacingXSmall),
            Text(
              text,
              style: TextStyles.caption.copyWith(
                color: ThemeColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAgreementSection() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: Checkbox(
            value: _agreedToTerms,
            onChanged: (value) {
              setState(() {
                _agreedToTerms = value ?? false;
              });
            },
            activeColor: ThemeColors.primary,
          ),
        ),
        SizedBox(width: Dimensions.spacingXSmall),
        Flexible(
          child: Text.rich(
            TextSpan(
              text: QyAppLocalizationKeys.qyAuthAgreementPrefix.tr(context),
              style: TextStyles.caption.copyWith(
                color: ThemeColors.textTertiary,
              ),
              children: [
                TextSpan(
                  text: QyAppLocalizationKeys.qyAuthTermsOfService.tr(context),
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.primary,
                    decoration: TextDecoration.underline,
                  ),
                ),
                TextSpan(
                  text: ' ${QyAppLocalizationKeys.qyAuthAnd.tr(context)} ',
                ),
                TextSpan(
                  text: QyAppLocalizationKeys.qyAuthPrivacyPolicy.tr(context),
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.primary,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
