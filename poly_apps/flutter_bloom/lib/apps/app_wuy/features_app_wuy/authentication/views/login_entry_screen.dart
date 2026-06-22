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
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_common_logo.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';

/// Login Entry Screen for Wuy App
/// 
/// This is the main entry point for user authentication.
/// Displays the app logo, name, and provides access to login/register functionality.
/// 
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyAppName.tr(context)
class WuyLoginEntryScreen extends StatelessWidget {
  const WuyLoginEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: WuyAppThemeConfig.wuyBackgroundDecoration,
      child: Scaffold(
        backgroundColor: ThemeColors.transparent,
        body: SafeArea(
          child: Stack(
            children: [
              Positioned(
                top: 40,
                left: 24,
                right: 24,
                child: _buildHeader(context),
              ),
              Center(
                child: Container(
                  width: double.infinity,
                  constraints: const BoxConstraints(maxWidth: 400),
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildLogo(context),
                      const SizedBox(height: 48),
                      _buildMainButton(context),
                      const SizedBox(height: 20),
                      _buildUserAgreement(context),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: 32,
                left: 0,
                right: 0,
                child: _buildOtherLoginMethods(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          LocalizationKeysAppWuy.wuyAppName.tr(context),
          style: ThemeTextStyles.displayLarge.copyWith(
            fontSize: 42,
            fontWeight: FontWeight.w800,
            color: WuyAppThemeConfig.wuyTextMain,
            letterSpacing: -0.5,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.only(left: 2),
          child: Text(
            LocalizationKeysAppWuy.wuyAppSlogan.tr(context),
            style: ThemeTextStyles.bodyLarge.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: WuyAppThemeConfig.wuyTextSub.withOpacity(0.85),
              letterSpacing: 0.3,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLogo(BuildContext context) {
    return const WuyCommonLogo();
  }

  Widget _buildMainButton(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 360),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: WuyAppThemeConfig.wuyAccentColor.withOpacity(0.2),
            blurRadius: 30,
            offset: const Offset(0, 12),
            spreadRadius: -5,
          ),
        ],
      ),
      child: WuyGradientButton(
        text: LocalizationKeysAppWuy.wuyPhoneLoginRegister.tr(context),
        onPressed: () {
          context.go(WuyAppRouter.routeLoginRegister);
        },
        height: 56,
        borderRadius: 28.0,
        gradientColors: WuyAppThemeConfig.wuyLoginButtonGradient.colors,
        textColor: ThemeColors.white,
        fontSize: 17,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _buildUserAgreement(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GestureDetector(
        onTap: () {
          // Handle user agreement tap
        },
        child: Text(
          LocalizationKeysAppWuy.wuyUserAgreement.tr(context),
          style: ThemeTextStyles.bodySmall.copyWith(
            color: WuyAppThemeConfig.wuyMuted.withOpacity(0.75),
            fontSize: 12,
            height: 1.6,
            letterSpacing: 0.2,
          ),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  Widget _buildOtherLoginMethods(BuildContext context) {
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 20),
          child: Text(
            LocalizationKeysAppWuy.wuyOtherLoginMethods.tr(context),
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: WuyAppThemeConfig.wuyTextSub.withOpacity(0.8),
              fontSize: 13,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildSocialLoginButton(
              icon: FontAwesomeIcons.weixin,
              onTap: () => _handleWeChatLogin(context),
            ),
            const SizedBox(width: 20),
            _buildSocialLoginButton(
              icon: FontAwesomeIcons.qq,
              onTap: () => _handleQQLogin(context),
            ),
            const SizedBox(width: 20),
            _buildSocialLoginButton(
              icon: FontAwesomeIcons.mobileScreen,
              onTap: () => _handleDingTalkLogin(context),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSocialLoginButton({
    String? text,
    IconData? icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: ThemeColors.white,
          shape: BoxShape.circle,
          border: Border.all(
            color: WuyAppThemeConfig.wuyBorder.withOpacity(0.3),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.black.withOpacity(0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),
              spreadRadius: 0,
            ),
            BoxShadow(
              color: ThemeColors.black.withOpacity(0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
              spreadRadius: 0,
            ),
          ],
        ),
        child: Center(
          child: icon != null
              ? FaIcon(
                  icon,
                  size: 22,
                  color: WuyAppThemeConfig.wuyTextSub,
                )
              : Text(
                  text ?? '',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: WuyAppThemeConfig.wuyTextSub,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
      ),
    );
  }

  void _handleWeChatLogin(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${LocalizationKeysAppWuy.wuyMessageWeChatApiConnecting.tr(context)}\n${LocalizationKeysAppWuy.wuyMessageRecommendPhoneLogin.tr(context)}',
        ),
        duration: const Duration(seconds: 3),
        backgroundColor: ThemeColors.orange60,
      ),
    );
  }

  void _handleQQLogin(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${LocalizationKeysAppWuy.wuyMessageQQApiConnecting.tr(context)}\n${LocalizationKeysAppWuy.wuyMessageRecommendPhoneLogin.tr(context)}',
        ),
        duration: const Duration(seconds: 3),
        backgroundColor: ThemeColors.blue60,
      ),
    );
  }

  void _handleDingTalkLogin(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${LocalizationKeysAppWuy.wuyMessageDingTalkApiConnecting.tr(context)}\n${LocalizationKeysAppWuy.wuyMessageRecommendPhoneLogin.tr(context)}',
        ),
        duration: const Duration(seconds: 3),
        backgroundColor: ThemeColors.green60,
      ),
    );
  }
}

