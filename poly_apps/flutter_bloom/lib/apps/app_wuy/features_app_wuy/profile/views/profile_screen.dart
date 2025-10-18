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
import 'package:qyflutter/common/widgets/floating_avatar_header.dart';
import 'package:qyflutter/common/widgets/info_row_widget.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../utils_app_wuy/auth_guard.dart';
import '../../../services_app_wuy/wuy_data_manager.dart';
import '../../../models_app_wuy/user_model_app_wuy.dart';

/// Profile Screen for Wuy App
///
/// This screen displays user profile information and settings options.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyProfileTitle.tr(context)
class WuyProfileScreen extends StatelessWidget {
  const WuyProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final dataManager = WuyDataManager.instance;
    final user = dataManager.currentUser;

    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      body: Column(
        children: [
          // Floating avatar header
          FloatingAvatarHeader(
            backgroundImage: CommonAssetsImages.wuyBackground1,
            avatarImage: user?.avatarUrl ?? user?.avatar,
            displayName: user?.displayName ?? user?.name ?? '',
            subtitle: user?.about ?? '',
            onBackTap: () => Navigator.of(context).pop(),
            onAvatarTap: () {
              // Handle avatar tap - could open image picker
            },
            showBackButton: true,
            backgroundHeight: 200.0,
            avatarSize: 120.0,
          ),
          // Profile content with space for floating avatar
          Expanded(
            child: Container(
              margin: EdgeInsets.only(top: 60), // Space for floating avatar
              child: SingleChildScrollView(
                child: Padding(
                  padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
                  child: Column(
                    children: [
                      _buildProfileInfo(context, user),
                      SizedBox(height: ThemeDimensions.spacingLarge),
                      _buildProfileActions(context),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: WuyBottomNavigation(
        currentIndex: 3, // Profile is the 4th item (index 3)
        onTap: (index) {
          switch (index) {
            case 0:
              context.go(WuyAppRouter.getSearchRoute());
              break;
            case 1:
              context.go(WuyAppRouter.getFriendsRoute());
              break;
            case 2:
              context.go(WuyAppRouter.getFindFriendsRoute());
              break;
            case 3:
              // Already on profile page
              break;
          }
        },
      ),
    );
  }

  String _maskPhoneNumber(String phone) {
    if (phone.length <= 4) return phone;
    final start = phone.substring(0, 3);
    final end = phone.substring(phone.length - 2);
    return '$start******$end';
  }

  String _maskEmail(String email) {
    if (!email.contains('@')) return email;
    final parts = email.split('@');
    if (parts[0].length <= 4) return email;
    final start = parts[0].substring(0, 4);
    final end = parts[0].substring(parts[0].length - 1);
    return '$start*********$end@${parts[1]}';
  }

  String? _formatBirthDate(String? birthday) {
    if (birthday == null || birthday.isEmpty) return null;
    try {
      final date = DateTime.parse(birthday);
      return '${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')}';
    } catch (e) {
      return birthday;
    }
  }

  String _getGenderDisplay(String? gender, BuildContext context) {
    if (gender == null || gender.isEmpty) return '';

    if (gender.toLowerCase() == 'male' || gender == '男') {
      return LocalizationKeysAppWuy.wuyProfileMale.tr(context);
    } else if (gender.toLowerCase() == 'female' || gender == '女') {
      return LocalizationKeysAppWuy.wuyProfileFemale.tr(context);
    }

    return gender;
  }

  String _getPhoneDisplay(UserModelAppWuy? user) {
    final phone = user?.phoneNumber ?? user?.phone;
    if (phone == null || phone.isEmpty) return '';
    return _maskPhoneNumber(phone);
  }

  String _getEmailDisplay(UserModelAppWuy? user) {
    final email = user?.email;
    if (email == null || email.isEmpty) return '';
    return _maskEmail(email);
  }

  String _getIdNumberDisplay(UserModelAppWuy? user) {
    // Check if user has ID number in meta or preferences
    final idNumber = user?.meta['id_number'] ??
        user?.preferences['id_number'] ??
        user?.meta['idNumber'] ??
        user?.preferences['idNumber'];

    if (idNumber == null || idNumber.toString().isEmpty) return '';

    // Mask ID number for privacy
    final idStr = idNumber.toString();
    if (idStr.length < 8) return idStr;

    final start = idStr.substring(0, 4);
    final end = idStr.substring(idStr.length - 4);
    return '$start${'*' * (idStr.length - 8)}$end';
  }

  Widget _buildProfileInfo(BuildContext context, UserModelAppWuy? user) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          children: [
            InfoRowWidget(
              label: LocalizationKeysAppWuy.wuyProfileName.tr(context),
              value: user?.displayName ?? '',
              onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
            ),
            Divider(),
            InfoRowWidget(
              label: LocalizationKeysAppWuy.wuyProfileSignature.tr(context),
              value: user?.about ?? '',
              onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
            ),
            Divider(),
            InfoRowWidget(
              label: LocalizationKeysAppWuy.wuyProfileGender.tr(context),
              value: _getGenderDisplay(user?.gender, context),
              onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
            ),
            Divider(),
            InfoRowWidget(
              label: LocalizationKeysAppWuy.wuyProfilePhone.tr(context),
              value: _getPhoneDisplay(user),
              onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
            ),
            Divider(),
            InfoRowWidget(
              label: LocalizationKeysAppWuy.wuyProfileBirthDate.tr(context),
              value: _formatBirthDate(user?.birthday) ?? '',
              onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
            ),
            Divider(),
            InfoRowWidget(
              label: LocalizationKeysAppWuy.wuyProfileLocation.tr(context),
              value: user?.city ?? '',
              onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
            ),
            Divider(),
            InfoRowWidget(
              label: LocalizationKeysAppWuy.wuyProfileEmail.tr(context),
              value: _getEmailDisplay(user),
              onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
            ),
            Divider(),
            InfoRowWidget(
              label: LocalizationKeysAppWuy.wuyProfileIdNumber.tr(context),
              value: _getIdNumberDisplay(user),
              onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileActions(BuildContext context) {
    return Column(
      children: [
        WuyGradientButton(
          text: LocalizationKeysAppWuy.wuyProfileEditProfile.tr(context),
          onPressed: () {
            // Edit profile action
          },
          height: 50,
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        WuyGradientButton(
          text: LocalizationKeysAppWuy.wuyProfileLogout.tr(context),
          onPressed: () {
            AuthGuard.onLogout(context);
          },
          height: 50,
          backgroundColor: Colors.white,
          textColor: ThemeColors.error,
          gradientColors: null,
        ),
      ],
    );
  }
}
