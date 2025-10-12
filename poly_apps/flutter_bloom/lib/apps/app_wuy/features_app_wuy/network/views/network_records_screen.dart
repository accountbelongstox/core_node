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
import '../../../router_app_wuy/router_app_wuy.dart';

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
  State<WuyNetworkRecordsScreen> createState() => _WuyNetworkRecordsScreenState();
}

class _WuyNetworkRecordsScreenState extends State<WuyNetworkRecordsScreen> {
  List<NetworkRecord> _networkRecords = [];

  @override
  void initState() {
    super.initState();
    _loadNetworkRecords();
  }

  void _loadNetworkRecords() {
    // Mock data based on the screenshot
    _networkRecords = [
      NetworkRecord(
        date: '2025-10-21',
        time: '20:00',
        description: '登录到小飞侠的账户',
        type: NetworkType.login,
        status: NetworkStatus.success,
      ),
      NetworkRecord(
        date: '2025-10-21',
        time: '20:00',
        description: '登录成功',
        type: NetworkType.success,
        status: NetworkStatus.success,
      ),
      NetworkRecord(
        date: '2025-10-21',
        time: '19:45',
        description: '连接WiFi网络',
        type: NetworkType.wifi,
        status: NetworkStatus.success,
      ),
      NetworkRecord(
        date: '2025-10-21',
        time: '19:30',
        description: '移动网络连接',
        type: NetworkType.mobile,
        status: NetworkStatus.success,
      ),
      NetworkRecord(
        date: '2025-10-21',
        time: '19:15',
        description: '网络请求超时',
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
          'Network Records',
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
            Colors.orange.shade400,
            Colors.red.shade400,
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
                    Icons.network_check,
                    size: 40,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                Text(
                  '小飞侠',
                  style: ThemeTextStyles.title2.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Network Activity',
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

  Widget _buildNetworkRecordsList() {
    return Container(
      color: Colors.lightGreen.shade50,
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
                  record.description,
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
        iconColor = Colors.blue;
        break;
      case NetworkType.success:
        iconData = Icons.check_circle;
        iconColor = Colors.green;
        break;
      case NetworkType.wifi:
        iconData = Icons.wifi;
        iconColor = Colors.orange;
        break;
      case NetworkType.mobile:
        iconData = Icons.signal_cellular_alt;
        iconColor = Colors.purple;
        break;
      case NetworkType.error:
        iconData = Icons.error;
        iconColor = Colors.red;
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
    String statusText;

    switch (status) {
      case NetworkStatus.success:
        statusColor = Colors.green;
        statusText = 'Success';
        break;
      case NetworkStatus.error:
        statusColor = Colors.red;
        statusText = 'Error';
        break;
      case NetworkStatus.pending:
        statusColor = Colors.orange;
        statusText = 'Pending';
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
        statusText,
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
  final String description;
  final NetworkType type;
  final NetworkStatus status;

  NetworkRecord({
    required this.date,
    required this.time,
    required this.description,
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
