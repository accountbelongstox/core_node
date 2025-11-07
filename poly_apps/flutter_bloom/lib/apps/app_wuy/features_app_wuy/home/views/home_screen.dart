// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';

/// Home Screen for Wuy App
/// 
/// This is the main home screen that displays app features and navigation options.
/// 
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyHomeTitle.tr(context)
class WuyHomeScreen extends StatelessWidget {
  const WuyHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          LocalizationKeysAppWuy.wuyHomeTitle.tr(context),
          style: ThemeTextStyles.headline3.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 22,
            letterSpacing: -0.5,
          ),
        ),
        backgroundColor: ThemeColors.primaryColor,
        elevation: 0,
        centerTitle: true,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                ThemeColors.primaryColor,
                ThemeColors.primaryColor.withOpacity(0.9),
              ],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            _buildWelcomeSection(context),
            const SizedBox(height: 32),
            _buildFeatureCard(
              context,
              LocalizationKeysAppWuy.wuyHomeProfile.tr(context),
              LocalizationKeysAppWuy.wuyHomeViewProfile.tr(context),
              Icons.person,
              ThemeColors.blue,
              () => context.go(WuyAppRouter.routeProfile),
            ),
            const SizedBox(height: 16),
            _buildFeatureCard(
              context,
              LocalizationKeysAppWuy.wuyHomeSettings.tr(context),
              LocalizationKeysAppWuy.wuyHomeConfigureSettings.tr(context),
              Icons.settings,
              ThemeColors.purple,
              () => context.go(WuyAppRouter.routeSettings),
            ),
            const SizedBox(height: 16),
            _buildFeatureCard(
              context,
              LocalizationKeysAppWuy.wuyHomeDashboard.tr(context),
              LocalizationKeysAppWuy.wuyHomeViewDashboard.tr(context),
              Icons.dashboard,
              ThemeColors.orange,
              () => context.go(WuyAppRouter.routeDashboard),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildWelcomeSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primaryColor.withOpacity(0.1),
            ThemeColors.accent.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: ThemeColors.primaryColor.withOpacity(0.1),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LocalizationKeysAppWuy.wuyHomeWelcome.tr(context),
            style: ThemeTextStyles.headline2.copyWith(
              fontWeight: FontWeight.w800,
              fontSize: 28,
              letterSpacing: -0.8,
              color: ThemeColors.primaryColor,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            LocalizationKeysAppWuy.wuyHomeDescription.tr(context),
            style: ThemeTextStyles.bodyText1.copyWith(
              fontSize: 15,
              height: 1.5,
              letterSpacing: 0.2,
              color: ThemeColors.textPrimary.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCard(
    BuildContext context,
    String title,
    String subtitle,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.15),
            blurRadius: 16,
            offset: const Offset(0, 4),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
            spreadRadius: 0,
          ),
        ],
      ),
      child: Material(
        color: ThemeColors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        color,
                        color.withOpacity(0.8),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: color.withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Icon(
                    icon,
                    color: ThemeColors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: ThemeTextStyles.headline6.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 17,
                          letterSpacing: -0.3,
                          color: ThemeColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: ThemeTextStyles.bodyText2.copyWith(
                          fontSize: 14,
                          height: 1.4,
                          letterSpacing: 0.1,
                          color: ThemeColors.textSecondary.withOpacity(0.8),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.arrow_forward_ios,
                    color: color,
                    size: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}