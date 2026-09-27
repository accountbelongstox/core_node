// Refactored by: Claude Code AI Assistant
// Date: 2024-12-19
// Changes: Updated to use proper theming and follow new Flutter guide standards
// Note to other AIs: This widget now uses ThemeColors and ThemeDimensions

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/profile/domain/model/profile_model.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class ProfileHeader extends StatelessWidget {
  final ProfileModel profile;
  final VoidCallback onQrCodeTap;

  const ProfileHeader({
    super.key,
    required this.profile,
    required this.onQrCodeTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ThemeColors.white90,
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacingMedium,
        vertical: ThemeDimensions.spacing18,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _buildAvatar(),
          const SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: _buildProfileInfo(),
          ),
          _buildQrCodeButton(),
        ],
      ),
    );
  }

  Widget _buildAvatar() {
    return Container(
      width: 60,
      height: 60,
      decoration: BoxDecoration(
        color: ThemeColors.grey200,
        borderRadius: BorderRadius.circular(ThemeDimensions.spacing12),
      ),
      alignment: Alignment.center,
      child: Text(
        profile.avatar.isNotEmpty ? profile.avatar : 'U',
        style: ThemeTextStyles.textMedium.copyWith(
          fontSize: 18,
          color: ThemeColors.grey600,
        ),
      ),
    );
  }

  Widget _buildProfileInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              profile.name,
              style: ThemeTextStyles.textBold.copyWith(fontSize: 18),
            ),
            if (profile.isVerified) ...[
              const SizedBox(width: ThemeDimensions.spacing6),
              Icon(
                Icons.verified,
                size: 16,
                color: ThemeColors.blue,
              ),
            ],
          ],
        ),
        const SizedBox(height: ThemeDimensions.spacing4),
        Text(
          profile.id,
          style: ThemeTextStyles.textRegular.copyWith(
            fontSize: 14,
            color: ThemeColors.grey600,
          ),
        ),
      ],
    );
  }

  Widget _buildQrCodeButton() {
    return IconButton(
      icon: Icon(
        Icons.qr_code,
        color: ThemeColors.black60,
        size: 28,
      ),
      onPressed: onQrCodeTap,
      tooltip: 'View QR Code',
    );
  }
} 
