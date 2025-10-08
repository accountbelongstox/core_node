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
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../resources_app_wuy/assets_icons_app_wuy.dart';

class WuyLoginEntryScreen extends StatelessWidget {
  const WuyLoginEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WuyAppThemeConfig.wuySurfaceColor,
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(WuyAppThemeConfig.wuyDefaultPadding),
          child: Column(
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildHeader(context),
                    SizedBox(height: WuyAppThemeConfig.wuyLargePadding * 2),
                    _buildLogo(context),
                    SizedBox(height: WuyAppThemeConfig.wuyLargePadding * 2),
                    _buildMainButton(context),
                    SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
                    _buildUserAgreement(context),
                  ],
                ),
              ),
              _buildOtherLoginMethods(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      children: [
        // Light blue wave-like graphic using theme colors
        Container(
          height: 60,
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.1),
                WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.2),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(30),
          ),
        ),
        SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
        // App name
        Text(
          LocalizationKeysAppWuy.wuyAppName.tr(context),
          style: ThemeTextStyles.displayLarge.copyWith(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: WuyAppThemeConfig.wuyTextPrimary,
          ),
        ),
        SizedBox(height: WuyAppThemeConfig.wuySmallPadding),
        // App slogan
        Text(
          LocalizationKeysAppWuy.wuyAppSlogan.tr(context),
          style: ThemeTextStyles.bodyLarge.copyWith(
            color: WuyAppThemeConfig.wuyTextSecondary,
            fontSize: 16,
          ),
        ),
      ],
    );
  }

  Widget _buildLogo(BuildContext context) {
    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        color: WuyAppThemeConfig.wuyPrimaryColor,
        borderRadius: BorderRadius.circular(WuyAppThemeConfig.wuyCardBorderRadius),
        boxShadow: WuyAppThemeConfig.wuyCardShadow.map((shadow) => BoxShadow(
          color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.3),
          blurRadius: 20,
          offset: const Offset(0, 10),
        )).toList(),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Try to load logo image, fallback to text
          Image.asset(
            WuyAppAssetsIcons.wuy_logo,
            width: 40,
            height: 40,
            errorBuilder: (context, error, stackTrace) {
              return Text(
                'An WuYou',
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              );
            },
          ),
          SizedBox(height: 4),
          Text(
            '安',
            style: ThemeTextStyles.displayMedium.copyWith(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainButton(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: () {
          context.go(WuyAppRouter.routePhoneLogin);
        },
        style: WuyAppThemeConfig.wuyPrimaryButton.copyWith(
          shape: MaterialStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(25),
            ),
          ),
          elevation: MaterialStateProperty.all(2),
        ),
        child: Text(
          LocalizationKeysAppWuy.wuyPhoneLoginRegister.tr(context),
          style: ThemeTextStyles.buttonLarge.copyWith(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildUserAgreement(BuildContext context) {
    return GestureDetector(
      onTap: () {
        // Handle user agreement tap
      },
      child: Text(
        LocalizationKeysAppWuy.wuyUserAgreement.tr(context),
        style: ThemeTextStyles.bodySmall.copyWith(
          color: WuyAppThemeConfig.wuyPrimaryColor,
          fontSize: 12,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _buildOtherLoginMethods(BuildContext context) {
    return Column(
      children: [
        Text(
          LocalizationKeysAppWuy.wuyOtherLoginMethods.tr(context),
          style: ThemeTextStyles.bodyMedium.copyWith(
            color: WuyAppThemeConfig.wuyTextSecondary,
            fontSize: 14,
          ),
        ),
        SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildSocialLoginButton(
              icon: Icons.chat_bubble_outline,
              onTap: () {
                // Handle WeChat login
              },
            ),
            SizedBox(width: WuyAppThemeConfig.wuyDefaultPadding),
            _buildSocialLoginButton(
              icon: Icons.pets,
              onTap: () {
                // Handle QQ login
              },
            ),
            SizedBox(width: WuyAppThemeConfig.wuyDefaultPadding),
            _buildSocialLoginButton(
              icon: Icons.account_balance_wallet_outlined,
              onTap: () {
                // Handle Alipay login
              },
            ),
          ],
        ),
        SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
      ],
    );
  }

  Widget _buildSocialLoginButton({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 50,
        height: 50,
        decoration: BoxDecoration(
          color: WuyAppThemeConfig.wuyBackgroundColor,
          shape: BoxShape.circle,
          border: Border.all(
            color: WuyAppThemeConfig.wuyTextSecondary.withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Icon(
          icon,
          color: WuyAppThemeConfig.wuyTextSecondary,
          size: 24,
        ),
      ),
    );
  }
}
