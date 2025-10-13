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
import '../../../services_app_wuy/wuy_data_manager.dart';

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
  List<HistoryRecord> _historyRecords = [];

  @override
  void initState() {
    super.initState();
    _loadHistoryRecords();
  }

  void _loadHistoryRecords() {
    // Mock data based on the screenshot
    _historyRecords = [
      HistoryRecord(
        date: '2025-10-20',
        time: '20:00',
        description: LocalizationKeysAppWuy.wuyHistoryLoginAccount.tr(context),
        type: HistoryType.login,
      ),
      HistoryRecord(
        date: '2025-10-20',
        time: '20:00',
        description: LocalizationKeysAppWuy.wuyHistoryLoginSuccess.tr(context),
        type: HistoryType.success,
      ),
      HistoryRecord(
        date: '2025-10-20',
        time: '19:30',
        description: LocalizationKeysAppWuy.wuyHistoryViewFriends.tr(context),
        type: HistoryType.action,
      ),
      HistoryRecord(
        date: '2025-10-20',
        time: '19:15',
        description: LocalizationKeysAppWuy.wuyHistorySendMessage.tr(context),
        type: HistoryType.message,
      ),
      HistoryRecord(
        date: '2025-10-20',
        time: '18:45',
        description: LocalizationKeysAppWuy.wuyHistoryUpdateProfile.tr(context),
        type: HistoryType.update,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'History Tracking',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
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
      height: 200,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.green.shade400,
            Colors.green.shade600,
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 50,
            left: 0,
            right: 0,
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: Colors.white.withOpacity(0.2),
                  child: Icon(
                    Icons.person,
                    size: 40,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                Text(
                  WuyDataManager.instance.currentUser?.displayName ?? 'User',
                  style: ThemeTextStyles.title2.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Activity History',
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: Colors.white.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryList() {
    return Container(
      color: Colors.lightBlue.shade50,
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: ListView.builder(
        itemCount: _historyRecords.length,
        itemBuilder: (context, index) {
          final record = _historyRecords[index];
          return _buildHistoryItem(record);
        },
      ),
    );
  }

  Widget _buildHistoryItem(HistoryRecord record) {
    return Container(
      margin: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      padding: EdgeInsets.all(ThemeDimensions.spacingMedium),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 5,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          _buildHistoryIcon(record.type),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${record.date} ${record.time}',
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ThemeColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingSmall),
                Text(
                  record.description,
                  style: ThemeTextStyles.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryIcon(HistoryType type) {
    IconData iconData;
    Color iconColor;

    switch (type) {
      case HistoryType.login:
        iconData = Icons.login;
        iconColor = Colors.blue;
        break;
      case HistoryType.success:
        iconData = Icons.check_circle;
        iconColor = Colors.green;
        break;
      case HistoryType.action:
        iconData = Icons.touch_app;
        iconColor = Colors.orange;
        break;
      case HistoryType.message:
        iconData = Icons.message;
        iconColor = Colors.purple;
        break;
      case HistoryType.update:
        iconData = Icons.edit;
        iconColor = Colors.teal;
        break;
    }

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: iconColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Icon(
        iconData,
        color: iconColor,
        size: 20,
      ),
    );
  }
}

class HistoryRecord {
  final String date;
  final String time;
  final String description;
  final HistoryType type;

  HistoryRecord({
    required this.date,
    required this.time,
    required this.description,
    required this.type,
  });
}

enum HistoryType {
  login,
  success,
  action,
  message,
  update,
}
