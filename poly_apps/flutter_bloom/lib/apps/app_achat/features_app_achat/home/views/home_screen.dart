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
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/apps/app_achat/router_app_achat/router_app_achat.dart';

class AchatHomeScreen extends StatelessWidget {
  const AchatHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.systemBackground,
      appBar: CustomAppBar(
        title: 'achat_home_title'.tr(context),
        showBackButton: false,
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'achat_welcome_title'.tr(context),
                      style: ThemeTextStyles.textBold.copyWith(fontSize: 24),
                    ),
                    const SizedBox(height: ThemeDimensions.paddingSizeSmall),
                    Text(
                      'achat_welcome_description'.tr(context),
                      style: ThemeTextStyles.textMedium.copyWith(
                        fontSize: 16,
                        color: ThemeColors.secondaryLabel,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            SizedBox(height: ThemeDimensions.sizeTwenty),

            // Quick actions
            Text(
              'achat_quick_actions'.tr(context),
              style: ThemeTextStyles.textBold.copyWith(fontSize: 18),
            ),
            const SizedBox(height: ThemeDimensions.paddingSizeDefault),

            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                mainAxisSpacing: ThemeDimensions.paddingSizeDefault,
                crossAxisSpacing: ThemeDimensions.paddingSizeDefault,
                children: [
                  _buildActionCard(
                    context,
                    icon: Icons.chat,
                    title: 'achat_start_chat'.tr(context),
                    onTap: () => RouterAppAChat.goToHome(context), // Changed from goToChatHome to goToHome
                  ),
                  _buildActionCard(
                    context,
                    icon: Icons.contacts,
                    title: 'achat_add_contacts'.tr(context),
                    onTap: () => RouterAppAChat.goToAddContacts(context),
                  ),
                  _buildActionCard(
                    context,
                    icon: Icons.group,
                    title: 'achat_create_group'.tr(context),
                    onTap: () => RouterAppAChat.goToCreateGroup(context),
                  ),
                  _buildActionCard(
                    context,
                    icon: Icons.person,
                    title: 'achat_profile'.tr(context),
                    onTap: () => RouterAppAChat.goToProfile(context),
                  ),
                  _buildActionCard(
                    context,
                    icon: Icons.settings,
                    title: 'achat_notification_settings'.tr(context),
                    onTap: () => RouterAppAChat.goToNotificationSetting(context),
                  ),
                  _buildActionCard(
                    context,
                    icon: Icons.qr_code,
                    title: 'achat_qr_profile'.tr(context),
                    onTap: () => RouterAppAChat.goToQrProfile(context),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
        child: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: ThemeDimensions.iconSizeXXL,
                color: Theme.of(context).primaryColor,
              ),
              SizedBox(height: ThemeDimensions.paddingSizeSmall),
              Text(
                title,
                textAlign: TextAlign.center,
                style: ThemeTextStyles.textMedium.copyWith(fontSize: 14),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
