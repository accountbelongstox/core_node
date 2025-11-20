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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../models_app_wuy/health_data_model_app_wuy.dart';
import '../../../models_app_wuy/phone_report_model_app_wuy.dart';
import '../../../services_app_wuy/wuy_fake_data_generator.dart';
import '../../../widgets_app_wuy/wuy_health_data_card.dart';
import '../../../widgets_app_wuy/wuy_phone_report_card.dart';
import 'package:qyflutter/common/widgets/floating_avatar_header.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';

/// Friend Info Screen for Wuy App
///
/// This screen displays detailed information about a specific friend.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyFriendInfoTitle.tr(context)
class WuyFriendInfoScreen extends StatefulWidget {
  final String friendId;

  const WuyFriendInfoScreen({
    super.key,
    required this.friendId,
  });

  @override
  State<WuyFriendInfoScreen> createState() => _WuyFriendInfoScreenState();
}

class _WuyFriendInfoScreenState extends State<WuyFriendInfoScreen> {
  FriendModelAppWuy? friend;

  @override
  void initState() {
    super.initState();
    _loadFriendData();
  }

  void _loadFriendData() {
    // Load friend data based on friendId
    // For now, use fake data generator
    final friends = WuyFakeDataGenerator.generateFakeFriends();
    friend = friends.firstWhere(
      (f) => f.id == widget.friendId,
      orElse: () => friends.first,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          LocalizationKeysAppWuy.wuyFriendInfoTitle.tr(context),
          style: ThemeTextStyles.displayMedium.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 22,
            letterSpacing: -0.5,
          ),
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        centerTitle: true,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                ThemeColors.primary,
                ThemeColors.primary.withOpacity(0.9),
              ],
            ),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeaderSection(),
            _buildHealthSection(),
            _buildPhoneReportSection(),
            _buildLocationsSection(),
            _buildAchievementsSection(),
            _buildActionsSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderSection() {
    return Column(
      children: [
        FloatingAvatarHeader(
          backgroundImage: CommonAssetsImages.wuyBackground2,
          avatarImage: friend?.avatarUrl,
          displayName: friend?.displayName ?? '',
          subtitle: friend?.bio ?? '',
          onBackTap: () => Navigator.of(context).pop(),
          onAvatarTap: () {
            // Handle friend avatar tap
          },
          showBackButton: true,
          backgroundHeight: 200.0,
          avatarSize: 120.0,
        ),
        // Add space for floating avatar (half of avatar size)
        SizedBox(height: 60),
      ],
    );
  }

  Widget _buildHealthSection() {
    HealthDataModelAppWuy? healthData;
    if (friend?.healthData != null) {
      healthData = HealthDataModelAppWuy.fromJson(friend!.healthData!);
    }

    return WuyHealthDataCard(
      healthData: healthData,
      title: LocalizationKeysAppWuy.wuyFriendInfoHealth.tr(context),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
    );
  }

  Widget _buildPhoneReportSection() {
    PhoneReportModelAppWuy? phoneReport;
    if (friend?.phoneReport != null) {
      phoneReport = PhoneReportModelAppWuy.fromJson(friend!.phoneReport!);
    }

    return WuyPhoneReportCard(
      phoneReport: phoneReport,
      title: LocalizationKeysAppWuy.wuyFriendInfoPhoneReport.tr(context),
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.spacingSmall,
      ),
    );
  }

  Widget _buildLocationsSection() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      padding: EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.04),
            blurRadius: 14,
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LocalizationKeysAppWuy.wuyFriendInfoPlacesVisited.tr(context),
            style: ThemeTextStyles.title3.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 19,
              letterSpacing: -0.4,
            ),
          ),
          SizedBox(height: 16),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary, size: 22),
              SizedBox(width: 12),
              Text(
                '2020-04-20 20:00',
                style: ThemeTextStyles.bodyMedium.copyWith(
                  fontSize: 15,
                  letterSpacing: 0.1,
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary, size: 22),
              SizedBox(width: 12),
              Text(
                '2020-04-20 18:30',
                style: ThemeTextStyles.bodyMedium.copyWith(
                  fontSize: 15,
                  letterSpacing: 0.1,
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary, size: 22),
              SizedBox(width: 12),
              Text(
                '2020-04-20 15:15',
                style: ThemeTextStyles.bodyMedium.copyWith(
                  fontSize: 15,
                  letterSpacing: 0.1,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAchievementsSection() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      padding: EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.04),
            blurRadius: 14,
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LocalizationKeysAppWuy.wuyFriendInfoAchievements.tr(context),
            style: ThemeTextStyles.title3.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 19,
              letterSpacing: -0.4,
            ),
          ),
          SizedBox(height: 16),
          _buildAchievementItem(LocalizationKeysAppWuy.wuyFriendInfoRunningKm.tr(context), '5.2 km'),
          _buildAchievementItem(LocalizationKeysAppWuy.wuyFriendInfoSteps.tr(context), '8,432'),
          _buildAchievementItem(LocalizationKeysAppWuy.wuyFriendInfoCalories.tr(context), '245 cal'),
          _buildAchievementItem(LocalizationKeysAppWuy.wuyFriendInfoSleep.tr(context), '7.5 hours'),
        ],
      ),
    );
  }

  Widget _buildAchievementItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: ThemeTextStyles.bodyMedium.copyWith(
              fontSize: 15,
              letterSpacing: 0.1,
              color: ThemeColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: ThemeTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              letterSpacing: 0.1,
              color: ThemeColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionsSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: ThemeColors.primary.withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                    spreadRadius: 0,
                  ),
                  BoxShadow(
                    color: ThemeColors.accent.withOpacity(0.15),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                    spreadRadius: -4,
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: () {
                  context.go(WuyAppRouter.routeHistoryTracks);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.history, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      LocalizationKeysAppWuy.wuyFriendInfoHistoryTracks.tr(context),
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: ThemeColors.green40.withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                    spreadRadius: 0,
                  ),
                  BoxShadow(
                    color: ThemeColors.green60.withOpacity(0.2),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                    spreadRadius: -4,
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: () {
                  context.go(WuyAppRouter.routeNetworkRecords);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.green40,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.network_check, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      LocalizationKeysAppWuy.wuyFriendInfoNetworkRecords.tr(context),
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
