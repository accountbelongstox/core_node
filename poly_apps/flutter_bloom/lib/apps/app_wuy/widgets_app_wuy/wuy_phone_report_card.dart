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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import '../models_app_wuy/phone_report_model_app_wuy.dart';
import '../models_app_wuy/network_record_model_app_wuy.dart';

class WuyPhoneReportCard extends StatelessWidget {
  final PhoneReportModelAppWuy? phoneReport;
  final String? title;
  final EdgeInsets? padding;

  const WuyPhoneReportCard({
    super.key,
    this.phoneReport,
    this.title,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: padding ?? EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      padding: EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      decoration: BoxDecoration(
        color: ThemeColors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title ?? 'Phone Report Today',
            style: ThemeTextStyles.title3Bold.copyWith(
              color: ThemeColors.label,
            ),
          ),
          SizedBox(height: ThemeDimensions.paddingSizeDefault),
          _buildNetworkRecordsSection(),
          SizedBox(height: ThemeDimensions.paddingSizeDefault),
          _buildStatisticsSection(),
        ],
      ),
    );
  }

  Widget _buildNetworkRecordsSection() {
    final networkRecords = phoneReport?.networkRecords ?? [];
    if (networkRecords.isEmpty) {
      return _buildEmptySection('No network records');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.wifi,
              size: 16,
              color: ThemeColors.secondaryLabel,
            ),
            SizedBox(width: ThemeDimensions.spacing8),
            Text(
              'Network Records:',
              style: ThemeTextStyles.subheadBold.copyWith(
                color: ThemeColors.label,
              ),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing8),
        ...networkRecords.take(5).map((record) => _buildNetworkRecordItem(record)),
      ],
    );
  }

  Widget _buildNetworkRecordItem(NetworkRecordModelAppWuy record) {
    IconData icon;
    Color iconColor;
    String description;

    switch (record.type) {
      case NetworkType.wifi:
        icon = Icons.wifi;
        iconColor = ThemeColors.blue;
        description = record.wifiSsid != null
            ? 'Connected WiFi: ${record.wifiSsid}'
            : 'Connected to WiFi';
        break;
      case NetworkType.mobile:
        icon = Icons.signal_cellular_alt;
        iconColor = ThemeColors.green;
        description = 'Connected to Mobile Network';
        break;
      default:
        icon = Icons.network_check;
        iconColor = ThemeColors.grey500;
        description = 'Network change';
    }

    return Padding(
      padding: EdgeInsets.only(
        left: ThemeDimensions.paddingSizeDefault,
        bottom: ThemeDimensions.spacing4,
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: iconColor),
          SizedBox(width: ThemeDimensions.spacing8),
          Expanded(
            child: Text(
              '${record.formattedTime} $description',
              style: ThemeTextStyles.footnote.copyWith(
                color: ThemeColors.secondaryLabel,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatisticsSection() {
    return Column(
      children: [
        _buildStatItem(
          icon: Icons.lock_open,
          label: 'Unlock Phone Times',
          value: phoneReport?.displayUnlockCount ?? '0 times',
        ),
        SizedBox(height: ThemeDimensions.spacing8),
        _buildStatItem(
          icon: Icons.access_time,
          label: 'App Usage Duration',
          value: phoneReport?.formattedScreenTime ?? '00h 00m',
        ),
        SizedBox(height: ThemeDimensions.spacing8),
        _buildStatItem(
          icon: Icons.battery_std,
          label: 'Battery Level',
          value: phoneReport?.displayBatteryLevel ?? '0%',
        ),
      ],
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(
              icon,
              size: 16,
              color: ThemeColors.secondaryLabel,
            ),
            SizedBox(width: ThemeDimensions.spacing8),
            Text(
              label,
              style: ThemeTextStyles.subhead.copyWith(
                color: ThemeColors.label,
              ),
            ),
          ],
        ),
        Text(
          value,
          style: ThemeTextStyles.subheadBold.copyWith(
            color: ThemeColors.blue,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptySection(String message) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      decoration: BoxDecoration(
        color: ThemeColors.grey100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Center(
        child: Text(
          message,
          style: ThemeTextStyles.footnote.copyWith(
            color: ThemeColors.secondaryLabel,
          ),
        ),
      ),
    );
  }
}
