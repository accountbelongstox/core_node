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
import '../../../services_app_wuy/wuy_unified_service.dart';

/// Network Records Screen for Wuy App
///
/// This screen displays network activity and connection records.
///
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyNetworkTitle.tr(context)
class WuyNetworkRecordsScreen extends StatefulWidget {
  const WuyNetworkRecordsScreen({super.key});

  @override
  State<WuyNetworkRecordsScreen> createState() =>
      _WuyNetworkRecordsScreenState();
}

class _WuyNetworkRecordsScreenState extends State<WuyNetworkRecordsScreen> {
  List<NetworkRecord> _networkRecords = [];

  @override
  void initState() {
    super.initState();
    _loadNetworkRecords();
  }

  void _loadNetworkRecords() async {
    // Try to load from data manager first
    final dataManager = WuyUnifiedService();

    // TODO: Implement real network records loading from data manager
    // For now, use mock data with localized strings
    setState(() {
      _networkRecords = _generateMockNetworkRecords();
    });
  }

  List<NetworkRecord> _generateMockNetworkRecords() {
    return [
      NetworkRecord(
        date: '2025-10-21',
        time: '20:00',
        descriptionKey: LocalizationKeysAppWuy.wuyNetworkLoginAccount,
        type: NetworkType.login,
        status: NetworkStatus.success,
      ),
      NetworkRecord(
        date: '2025-10-21',
        time: '20:00',
        descriptionKey: LocalizationKeysAppWuy.wuyNetworkLoginSuccess,
        type: NetworkType.success,
        status: NetworkStatus.success,
      ),
      NetworkRecord(
        date: '2025-10-21',
        time: '19:45',
        descriptionKey: LocalizationKeysAppWuy.wuyNetworkConnectWifi,
        type: NetworkType.wifi,
        status: NetworkStatus.success,
      ),
      NetworkRecord(
        date: '2025-10-21',
        time: '19:30',
        descriptionKey: LocalizationKeysAppWuy.wuyNetworkMobileConnection,
        type: NetworkType.mobile,
        status: NetworkStatus.success,
      ),
      NetworkRecord(
        date: '2025-10-21',
        time: '19:15',
        descriptionKey: LocalizationKeysAppWuy.wuyNetworkRequestTimeout,
        type: NetworkType.error,
        status: NetworkStatus.error,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          LocalizationKeysAppWuy.wuyNetworkTitle.tr(context),
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: ThemeColors.white),
          onPressed: () => context.go(WuyAppRouter.routeHome),
        ),
      ),
      body: Column(
        children: [
          _buildHeaderSection(),
          Expanded(
            child: _buildNetworkRecordsList(),
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
            ThemeColors.orange40,
            ThemeColors.red40,
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
                  backgroundColor: ThemeColors.white.withOpacity(0.2),
                  child: Icon(
                    Icons.network_check,
                    size: 40,
                    color: ThemeColors.white,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                Text(
                  WuyUnifiedService().currentUser?.displayName ?? 'User',
                  style: ThemeTextStyles.title2.copyWith(
                    color: ThemeColors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  LocalizationKeysAppWuy.wuyNetworkActivity.tr(context),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: ThemeColors.white.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNetworkRecordsList() {
    return Container(
      color: ThemeColors.green05,
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: ListView.builder(
        itemCount: _networkRecords.length,
        itemBuilder: (context, index) {
          final record = _networkRecords[index];
          return _buildNetworkRecordItem(record);
        },
      ),
    );
  }

  Widget _buildNetworkRecordItem(NetworkRecord record) {
    return Container(
      margin: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      padding: EdgeInsets.all(ThemeDimensions.spacingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.1),
            blurRadius: 5,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          _buildNetworkIcon(record.type, record.status),
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
                  record.descriptionKey.tr(context),
                  style: ThemeTextStyles.bodyMedium,
                ),
                SizedBox(height: ThemeDimensions.spacingSmall),
                _buildStatusIndicator(record.status),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNetworkIcon(NetworkType type, NetworkStatus status) {
    IconData iconData;
    Color iconColor;

    switch (type) {
      case NetworkType.login:
        iconData = Icons.login;
        iconColor = ThemeColors.blue60;
        break;
      case NetworkType.success:
        iconData = Icons.check_circle;
        iconColor = ThemeColors.green60;
        break;
      case NetworkType.wifi:
        iconData = Icons.wifi;
        iconColor = ThemeColors.orange60;
        break;
      case NetworkType.mobile:
        iconData = Icons.signal_cellular_alt;
        iconColor = ThemeColors.purple60;
        break;
      case NetworkType.error:
        iconData = Icons.error;
        iconColor = ThemeColors.red60;
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

  Widget _buildStatusIndicator(NetworkStatus status) {
    Color statusColor;
    String statusTextKey;

    switch (status) {
      case NetworkStatus.success:
        statusColor = ThemeColors.green60;
        statusTextKey = LocalizationKeysAppWuy.wuyNetworkSuccess;
        break;
      case NetworkStatus.error:
        statusColor = ThemeColors.red60;
        statusTextKey = LocalizationKeysAppWuy.wuyNetworkError;
        break;
      case NetworkStatus.pending:
        statusColor = ThemeColors.orange60;
        statusTextKey = LocalizationKeysAppWuy.wuyNetworkPending;
        break;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacingSmall,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: statusColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        statusTextKey.tr(context),
        style: ThemeTextStyles.bodySmall.copyWith(
          color: statusColor,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class NetworkRecord {
  final String date;
  final String time;
  final String descriptionKey;
  final NetworkType type;
  final NetworkStatus status;

  NetworkRecord({
    required this.date,
    required this.time,
    required this.descriptionKey,
    required this.type,
    required this.status,
  });
}

enum NetworkType {
  login,
  success,
  wifi,
  mobile,
  error,
}

enum NetworkStatus {
  success,
  error,
  pending,
}
