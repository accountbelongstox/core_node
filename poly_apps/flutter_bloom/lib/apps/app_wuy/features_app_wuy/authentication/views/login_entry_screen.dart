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
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../resources_app_wuy/assets_icons_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';

class WuyLoginEntryScreen extends StatelessWidget {
  const WuyLoginEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: WuyAppThemeConfig.wuyBackgroundDecoration,
        child: SafeArea(
          child: Center(
            child: Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxWidth: 420), // Match HTML max-width
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24), // Match HTML padding
              child: Column(
                mainAxisAlignment: MainAxisAlignment.start,
                children: [
                  const SizedBox(height: 12), // Match HTML margin-top
                  _buildHeader(context),
                  _buildLogo(context),
                  _buildMainButton(context),
                  _buildUserAgreement(context),
                  _buildOtherLoginMethods(context),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // App name - matching HTML title style
        Text(
          LocalizationKeysAppWuy.wuyAppName.tr(context),
          style: ThemeTextStyles.displayLarge.copyWith(
            fontSize: 28, // Match HTML font-size: 28px
            fontWeight: FontWeight.w800, // Match HTML font-weight: 800
            color: WuyAppThemeConfig.wuyTextMain, // Match HTML --text-main
            letterSpacing: 0.5, // Match HTML letter-spacing: 0.5px
          ),
        ),
        const SizedBox(height: 8), // Match HTML margin-top: 8px
        // App slogan - matching HTML subtitle style
        Text(
          LocalizationKeysAppWuy.wuyAppSlogan.tr(context),
          style: ThemeTextStyles.bodyLarge.copyWith(
            fontSize: 16, // Match HTML font-size: 16px
            fontWeight: FontWeight.w500, // Match HTML font-weight: 500
            color: WuyAppThemeConfig.wuyTextSub, // Match HTML --text-sub
          ),
        ),
      ],
    );
  }

  Widget _buildLogo(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 24), // Match HTML margin: 24px 0 28px
      child: Center(
        child:         Image.asset(
          WuyAppAssetsIcons.logo, // Use common assets management
          width: 84, // Match HTML width: 84px
          height: 84, // Match HTML height: auto (84px)
          fit: BoxFit.contain, // Match HTML object-fit: contain
          errorBuilder: (context, error, stackTrace) {
            // Only show fallback if image really fails to load
            print('Logo image failed to load: $error');
            return Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: WuyAppThemeConfig.wuyPrimaryColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.apps,
                color: Colors.white,
                size: 48,
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildMainButton(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 360), // Match HTML max-width: 360px
      margin: const EdgeInsets.symmetric(horizontal: 0), // Match HTML margin: 0 auto
      child: ElevatedButton(
        onPressed: () {
          context.go(WuyAppRouter.routePhoneLogin);
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18), // Match HTML padding: 14px 18px
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999), // Match HTML border-radius: 999px
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            gradient: WuyAppThemeConfig.wuyLoginButtonGradient, // Match HTML gradient
            borderRadius: BorderRadius.circular(999),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF2F7BF3).withOpacity(0.25), // Match HTML box-shadow rgba(47, 123, 243, 0.25)
                blurRadius: 16, // Match HTML blur: 16px
                offset: const Offset(0, 8), // Match HTML offset: 0 8px
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
          child: Text(
            LocalizationKeysAppWuy.wuyPhoneLoginRegister.tr(context),
            style: ThemeTextStyles.buttonLarge.copyWith(
              color: Colors.white,
              fontSize: 16, // Match HTML font-size: 16px
              fontWeight: FontWeight.w700, // Match HTML font-weight: 700
            ),
            textAlign: TextAlign.center, // Match HTML text-align: center
          ),
        ),
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
              text: '微', // Match HTML "微"
              onTap: () {
                // Handle WeChat login
              },
            ),
            const SizedBox(width: 16), // Match HTML gap: 16px
            _buildSocialLoginButton(
              text: 'Q', // Match HTML "Q"
              onTap: () {
                // Handle QQ login
              },
            ),
            const SizedBox(width: 16), // Match HTML gap: 16px
            _buildSocialLoginButton(
              text: '钉', // Match HTML "钉"
              onTap: () {
                // Handle DingTalk login
              },
            ),
          ],
        ),
        const SizedBox(height: 24), // Match HTML margin-bottom: 24px
      ],
    );
  }

  Widget _buildSocialLoginButton({
    required String text,
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
          child: Text(
            text,
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
}

