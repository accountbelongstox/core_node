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
import 'package:qyflutter/common/assets/common_assets_images.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../services_app_wuy/wuy_unified_service.dart';
import '../../../models_app_wuy/history_record_model_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_location_history_item.dart';

/// History Tracking Screen for Wuy App
///
/// This screen displays user activity history and tracking information.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyHistoryTitle.tr(context)
class WuyHistoryTrackingScreen extends StatefulWidget {
  const WuyHistoryTrackingScreen({super.key});

  @override
  State<WuyHistoryTrackingScreen> createState() =>
      _WuyHistoryTrackingScreenState();
}

class _WuyHistoryTrackingScreenState extends State<WuyHistoryTrackingScreen> {
  List<HistoryRecordModelAppWuy> historyRecords = [];
  double totalDistance = 0.0;
  String userName = '';

  @override
  void initState() {
    super.initState();
    _loadHistoryData();
  }

  void _loadHistoryData() async {
    final dataManager = WuyUnifiedService();
    userName = dataManager.currentUser?.displayName ?? 'User';

    setState(() {
      historyRecords = [];
      totalDistance = 0.0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          LocalizationKeysAppWuy.wuyHistoryTitle.tr(context),
          style: ThemeTextStyles.displayMedium.copyWith(
            color: ThemeColors.white,
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
          icon: const Icon(Icons.arrow_back, color: ThemeColors.white),
          onPressed: () => context.go(WuyAppRouter.routeHome),
        ),
      ),
      body: Column(
        children: [
          _buildHeaderSection(),
          Expanded(
            child: _buildHistoryList(),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderSection() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        image: DecorationImage(
          image: AssetImage(CommonAssetsImages.wuyBackground2),
          fit: BoxFit.cover,
        ),
      ),
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: ThemeDimensions.paddingSizeLarge,
          horizontal: ThemeDimensions.paddingSizeDefault,
        ),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              ThemeColors.primary.withOpacity(0.8),
              ThemeColors.primary.withOpacity(0.9),
            ],
          ),
        ),
        child: Column(
          children: [
            Text(
              userName,
              style: ThemeTextStyles.title1.copyWith(
                color: ThemeColors.white,
                fontWeight: FontWeight.w700,
                fontSize: 28,
                letterSpacing: -0.7,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing8),
            Text(
              '守护你的未来',
              style: ThemeTextStyles.subhead.copyWith(
                color: ThemeColors.white.withOpacity(0.9),
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: ThemeDimensions.paddingSizeDefault),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.route,
                  color: ThemeColors.white,
                  size: 32,
                ),
                SizedBox(width: ThemeDimensions.spacing8),
                Text(
                  '轨迹 ${totalDistance.toStringAsFixed(1)}KM',
                  style: ThemeTextStyles.title1Bold.copyWith(
                    color: ThemeColors.white,
                    fontSize: 26,
                    letterSpacing: -0.6,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryList() {
    if (historyRecords.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.location_off,
              size: 64,
              color: ThemeColors.secondaryLabel,
            ),
            SizedBox(height: ThemeDimensions.paddingSizeDefault),
            Text(
              'No location history',
              style: ThemeTextStyles.body.copyWith(
                color: ThemeColors.secondaryLabel,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      color: ThemeColors.lightBackground,
      child: ListView.builder(
        padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing8),
        itemCount: historyRecords.length,
        itemBuilder: (context, index) {
          final record = historyRecords[index];
          return WuyLocationHistoryItem(
            record: record,
            onTap: () {
            },
          );
        },
      ),
    );
  }
}
