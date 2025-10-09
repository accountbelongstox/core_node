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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';

class WuyProfileScreen extends StatelessWidget {
  const WuyProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          LocalizationKeysAppWuy.wuyProfileTitle.tr(context),
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          children: [
            _buildProfileHeader(),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildProfileInfo(context),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildProfileActions(context),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeader() {
    return Column(
      children: [
        CircleAvatar(
          radius: 60,
          backgroundColor: ThemeColors.primary,
          child: Icon(
            Icons.person,
            size: 60,
            color: ThemeColors.white,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        Text(
          'Wuy User',
          style: ThemeTextStyles.displayMedium,
        ),
        Text(
          'user@wuyapp.com',
          style: ThemeTextStyles.bodyLarge.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildProfileInfo(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          children: [
            _buildInfoRow(LocalizationKeysAppWuy.wuyProfileUsername.tr(context), 'wuy_user'),
            Divider(),
            _buildInfoRow(LocalizationKeysAppWuy.wuyProfileEmail.tr(context), 'user@wuyapp.com'),
            Divider(),
            _buildInfoRow(LocalizationKeysAppWuy.wuyProfilePhone.tr(context), '+1 234 567 8900'),
            Divider(),
            _buildInfoRow(LocalizationKeysAppWuy.wuyProfileMemberSince.tr(context), 'January 2024'),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacingSmall),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: ThemeTextStyles.bodyLarge,
          ),
        ],
      ),
    );
  }

  Widget _buildProfileActions(BuildContext context) {
    return Column(
      children: [
        ElevatedButton(
          onPressed: () {
            // Edit profile action
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: ThemeColors.primary,
            minimumSize: Size(double.infinity, 50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
            ),
          ),
          child: Text(
            LocalizationKeysAppWuy.wuyProfileEditProfile.tr(context),
            style: ThemeTextStyles.buttonLarge,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        OutlinedButton(
          onPressed: () {
            context.go(WuyAppRouter.routeLoginEntry);
          },
          style: OutlinedButton.styleFrom(
            minimumSize: Size(double.infinity, 50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
            ),
          ),
          child: Text(
            LocalizationKeysAppWuy.wuyProfileLogout.tr(context),
            style: ThemeTextStyles.buttonLarge.copyWith(
              color: ThemeColors.error,
            ),
          ),
        ),
      ],
    );
  }
}