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
              // Header positioned at top left
              Positioned(
                top: 32, // Increased from 12 to 32 for better spacing
                left: 16,
                child: _buildHeader(context),
              ),
              // Center content (logo, button, agreement)
              Center(
                child: Container(
                  width: double.infinity,
                  constraints: const BoxConstraints(maxWidth: 420),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildLogo(context),
                      const SizedBox(height: 24),
                      _buildMainButton(context),
                      const SizedBox(height: 16),
                      _buildUserAgreement(context),
                    ],
                  ),
                ),
              ),
              // Other login methods positioned at bottom
              Positioned(
                bottom: 24,
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
    return Align(
      alignment: Alignment.topLeft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // App name - positioned at top left
          Text(
            LocalizationKeysAppWuy.wuyAppName.tr(context),
            style: ThemeTextStyles.displayLarge.copyWith(
              fontSize: 40, // Doubled from 20px to 40px
              fontWeight: FontWeight.w800,
              color: WuyAppThemeConfig.wuyTextMain,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4), // Reduced spacing
          // App slogan - with indentation
          Padding(
            padding: const EdgeInsets.only(left: 16), // Indent second line
            child: Text(
              LocalizationKeysAppWuy.wuyAppSlogan.tr(context),
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontSize: 32, // Doubled from 16px to 32px
                fontWeight: FontWeight.w500,
                color: WuyAppThemeConfig.wuyTextSub,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogo(BuildContext context) {
    return const WuyCommonLogo();
  }

  Widget _buildMainButton(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 360),
      child: WuyGradientButton(
        text: LocalizationKeysAppWuy.wuyPhoneLoginRegister.tr(context),
        onPressed: () {
          context.go(WuyAppRouter.routeLoginRegister);
        },
        height: 50,
        borderRadius: 25.0, // 50% of height (50/2 = 25)
        gradientColors: WuyAppThemeConfig.wuyLoginButtonGradient.colors,
        textColor: ThemeColors.white,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _buildUserAgreement(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 12), // Match HTML margin-top: 12px
      child: GestureDetector(
        onTap: () {
          // Handle user agreement tap
        },
        child: Text(
          LocalizationKeysAppWuy.wuyUserAgreement.tr(context),
          style: ThemeTextStyles.bodySmall.copyWith(
            color: WuyAppThemeConfig.wuyMuted, // Match HTML color: var(--muted)
            fontSize: 12, // Match HTML font-size: 12px
          ),
          textAlign: TextAlign.center, // Match HTML text-align: center
        ),
      ),
    );
  }

  Widget _buildOtherLoginMethods(BuildContext context) {
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.only(top: 28, bottom: 14), // Match HTML margin: 28px 0 14px
          child: Text(
            LocalizationKeysAppWuy.wuyOtherLoginMethods.tr(context),
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: WuyAppThemeConfig.wuyTextSub, // Match HTML color: var(--text-sub)
              fontSize: 14, // Match HTML font-size: 14px
            ),
            textAlign: TextAlign.center, // Match HTML text-align: center
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildSocialLoginButton(
              icon: FontAwesomeIcons.weixin,
              onTap: () => _handleWeChatLogin(context),
            ),
            const SizedBox(width: 16), // Match HTML gap: 16px
            _buildSocialLoginButton(
              icon: FontAwesomeIcons.qq,
              onTap: () => _handleQQLogin(context),
            ),
            const SizedBox(width: 16), // Match HTML gap: 16px
            _buildSocialLoginButton(
              icon: FontAwesomeIcons.mobileScreen,
              onTap: () => _handleDingTalkLogin(context),
            ),
          ],
        ),
        const SizedBox(height: 24), // Match HTML margin-bottom: 24px
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
        width: 48, // Match HTML width: 48px
        height: 48, // Match HTML height: 48px
        decoration: BoxDecoration(
          color: const Color(0xFFF7F9FC), // Match HTML background: #f7f9fc
          shape: BoxShape.circle,
          border: Border.all(
            color: WuyAppThemeConfig.wuyBorder, // Match HTML border: 1px solid var(--border)
            width: 1,
          ),
        ),
        child: Center(
          child: icon != null
              ? FaIcon(
                  icon,
                  size: 20,
                  color: const Color(0xFFA0AFC2),
                )
              : Text(
                  text ?? '',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: const Color(0xFFA0AFC2), // Match HTML color: #a0afc2
                    fontSize: 16,
                    fontWeight: FontWeight.w700, // Match HTML font-weight: 700
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

