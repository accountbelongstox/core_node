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
          'Friend Info',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go(WuyAppRouter.routeHome),
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
      title: 'TA的健康',
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
      title: 'TA今天的手机报告',
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.spacingSmall,
      ),
    );
  }

  Widget _buildLocationsSection() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TA今天去过的地方',
            style: ThemeTextStyles.title3,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                '2020-04-20 20:00',
                style: ThemeTextStyles.bodyMedium,
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                '2020-04-20 18:30',
                style: ThemeTextStyles.bodyMedium,
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Row(
            children: [
              Icon(Icons.grid_view, color: ThemeColors.primary),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                '2020-04-20 15:15',
                style: ThemeTextStyles.bodyMedium,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAchievementsSection() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TA今天的成就',
            style: ThemeTextStyles.title3,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildAchievementItem('跑步公里', '5.2 km'),
          _buildAchievementItem('步数', '8,432'),
          _buildAchievementItem('卡路里', '245 cal'),
          _buildAchievementItem('睡眠', '7.5 hours'),
        ],
      ),
    );
  }

  Widget _buildAchievementItem(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacingSmall),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: ThemeTextStyles.bodyMedium,
          ),
          Text(
            value,
            style: ThemeTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.bold,
              color: ThemeColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionsSection() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Row(
        children: [
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                context.go(WuyAppRouter.routeHistoryTracks);
              },
              icon: Icon(Icons.history),
              label: Text(LocalizationKeysAppWuy.wuyFriendInfoHistoryTracks
                  .tr(context)),
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.primary,
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
                ),
              ),
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                context.go(WuyAppRouter.routeNetworkRecords);
              },
              icon: Icon(Icons.network_check),
              label: Text(LocalizationKeysAppWuy.wuyFriendInfoNetworkRecords
                  .tr(context)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
