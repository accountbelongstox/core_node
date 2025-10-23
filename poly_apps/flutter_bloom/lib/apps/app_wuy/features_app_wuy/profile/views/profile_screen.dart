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
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/floating_avatar_header.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';
import '../../../providers_app_wuy/wu_user_provider.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';
import '../../../widgets_app_wuy/wuy_gradient_button.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../utils_app_wuy/auth_guard.dart';
import '../../../services_app_wuy/wuy_unified_service.dart';
import '../../../models_app_wuy/user_model_app_wuy.dart';
import '../../../resources_app_wuy/assets_icons_app_wuy.dart';

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
    return Consumer<WuUserProvider>(
      builder: (context, userProvider, child) {
        final user = userProvider.user as UserModelAppWuy?;

        return Scaffold(
      backgroundColor: ThemeColors.grey50,
      body: CustomScrollView(
        physics: BouncingScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: FloatingAvatarHeader(
              backgroundImage: CommonAssetsImages.wuyBackground1,
              avatarImage: user?.unifiedAvatarUrl.isEmpty ?? true ? WuyAppAssetsIcons.avatarPlaceholder : user!.unifiedAvatarUrl,
              displayName: user?.displayName ?? '',
              subtitle: user?.about ?? '',
              onBackTap: () => Navigator.of(context).pop(),
              onAvatarTap: () {
                context.go(WuyAppRouter.getEditProfileRoute());
              },
              showBackButton: true,
              backgroundHeight: 120.0,
              avatarSize: 60.0,
              gradientColors: [
                ThemeColors.teal.withOpacity(0.85),
                ThemeColors.green.withOpacity(0.75),
                ThemeColors.blue60.withOpacity(0.65),
              ],
              gradientOpacity: 0.4,
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(height: 32),
          ),
          SliverToBoxAdapter(
            child: Center(
              child: Column(
                children: [
                  Text(
                    user?.displayName ?? '',
                    style: ThemeTextStyles.headline.copyWith(
                      fontWeight: FontWeight.w600,
                      color: ThemeColors.black,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (user?.about != null && user!.about!.isNotEmpty) ...[
                    SizedBox(height: 4),
                    Text(
                      user.about!,
                      style: ThemeTextStyles.footnote.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.paddingSizeDefault,
              vertical: 12,
            ),
            sliver: SliverToBoxAdapter(
              child: Column(
                children: [
                  _buildProfileInfo(context, user),
                  SizedBox(height: 12),
                  _buildProfileActions(context),
                  SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: WuyBottomNavigation(
        currentIndex: 3,
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
              break;
          }
        },
      ),
        );
      },
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
    final phone = user?.unifiedPhoneNumber;
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
      elevation: 0.3,
      shadowColor: ThemeColors.black.withOpacity(0.03),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      color: ThemeColors.white,
      child: Padding(
        padding: EdgeInsets.symmetric(
          vertical: 6,
          horizontal: 12,
        ),
        child: Column(
          children: [
            _buildCompactInfoRow(context, LocalizationKeysAppWuy.wuyProfileName.tr(context), user?.displayName ?? ''),
            Divider(height: 1, thickness: 0.3, color: ThemeColors.grey200),
            _buildCompactInfoRow(context, LocalizationKeysAppWuy.wuyProfileSignature.tr(context), user?.about ?? ''),
            Divider(height: 1, thickness: 0.3, color: ThemeColors.grey200),
            _buildCompactInfoRow(context, LocalizationKeysAppWuy.wuyProfileGender.tr(context), _getGenderDisplay(user?.gender, context)),
            Divider(height: 1, thickness: 0.3, color: ThemeColors.grey200),
            _buildCompactInfoRow(context, LocalizationKeysAppWuy.wuyProfilePhone.tr(context), _getPhoneDisplay(user)),
            Divider(height: 1, thickness: 0.3, color: ThemeColors.grey200),
            _buildCompactInfoRow(context, LocalizationKeysAppWuy.wuyProfileBirthDate.tr(context), _formatBirthDate(user?.birthday) ?? ''),
            Divider(height: 1, thickness: 0.3, color: ThemeColors.grey200),
            _buildCompactInfoRow(context, LocalizationKeysAppWuy.wuyProfileLocation.tr(context), user?.city ?? ''),
            Divider(height: 1, thickness: 0.3, color: ThemeColors.grey200),
            _buildCompactInfoRow(context, LocalizationKeysAppWuy.wuyProfileEmail.tr(context), _getEmailDisplay(user)),
            Divider(height: 1, thickness: 0.3, color: ThemeColors.grey200),
            _buildCompactInfoRow(context, LocalizationKeysAppWuy.wuyProfileIdNumber.tr(context), _getIdNumberDisplay(user)),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactInfoRow(BuildContext context, String label, String value) {
    return GestureDetector(
      onTap: () => context.go(WuyAppRouter.getEditProfileRoute()),
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: ThemeTextStyles.footnote.copyWith(
                color: ThemeColors.grey600,
              ),
            ),
            Row(
              children: [
                Flexible(
                  child: Text(
                    value,
                    style: ThemeTextStyles.footnote.copyWith(
                      color: ThemeColors.black,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                SizedBox(width: 4),
                Icon(
                  Icons.arrow_forward_ios,
                  size: 12,
                  color: ThemeColors.grey400,
                ),
              ],
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
            context.go(WuyAppRouter.getEditProfileRoute());
          },
          height: 38,
        ),
        SizedBox(height: 8),
        Container(
          height: 38,
          decoration: BoxDecoration(
            color: ThemeColors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: ThemeColors.red.withOpacity(0.3),
              width: 1,
            ),
          ),
          child: Material(
            color: ThemeColors.transparent,
            child: InkWell(
              onTap: () async {
                await AuthGuard.onLogout(context);
              },
              borderRadius: BorderRadius.circular(10),
              child: Center(
                child: Text(
                  LocalizationKeysAppWuy.wuyProfileLogout.tr(context),
                  style: ThemeTextStyles.subhead.copyWith(
                    color: ThemeColors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
