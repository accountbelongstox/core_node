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
import '../../../models_app_wuy/network_record_model_app_wuy.dart';

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
  List<NetworkRecordModelAppWuy> networkRecords = [];

  @override
  void initState() {
    super.initState();
    _loadNetworkRecords();
  }

  void _loadNetworkRecords() async {
    final dataManager = WuyUnifiedService();

    setState(() {
      networkRecords = [];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          LocalizationKeysAppWuy.wuyNetworkTitle.tr(context),
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
          onPressed: () => context.pop(),
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
            child: SizedBox(
              height: 150,
              child: Column(
                mainAxisSize: MainAxisSize.min,
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
                      fontWeight: FontWeight.w700,
                      fontSize: 26,
                      letterSpacing: -0.6,
                    ),
                  ),
                  Text(
                    LocalizationKeysAppWuy.wuyNetworkActivity.tr(context),
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.white.withOpacity(0.9),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNetworkRecordsList() {
    if (networkRecords.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.network_check,
              size: 64,
              color: ThemeColors.secondaryLabel,
            ),
            SizedBox(height: ThemeDimensions.paddingSizeDefault),
            Text(
              LocalizationKeysAppWuy.wuyNetworkNoRecords.tr(context),
              style: ThemeTextStyles.body.copyWith(
                color: ThemeColors.secondaryLabel,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      color: ThemeColors.green05,
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: ListView.builder(
        itemCount: networkRecords.length,
        itemBuilder: (context, index) {
          final record = networkRecords[index];
          return _buildNetworkRecordItem(record);
        },
      ),
    );
  }

  Widget _buildNetworkRecordItem(NetworkRecordModelAppWuy record) {
    final IconData icon;
    final Color iconColor;
    final String description;

    switch (record.type) {
      case NetworkType.wifi:
        icon = Icons.wifi;
        iconColor = ThemeColors.blue;
        description = record.wifiSsid != null
            ? '${LocalizationKeysAppWuy.wuyNetworkConnectedWifiWith.tr(context)}: ${record.wifiSsid}'
            : LocalizationKeysAppWuy.wuyNetworkConnectedWifi.tr(context);
        break;
      case NetworkType.mobile:
        icon = Icons.signal_cellular_alt;
        iconColor = ThemeColors.green;
        description = LocalizationKeysAppWuy.wuyNetworkConnectedMobile.tr(context);
        break;
      default:
        icon = Icons.network_check;
        iconColor = ThemeColors.grey500;
        description = LocalizationKeysAppWuy.wuyNetworkChange.tr(context);
    }

    return Container(
      margin: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      padding: EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      decoration: BoxDecoration(
        color: ThemeColors.white,
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
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: 24,
            ),
          ),
          SizedBox(width: ThemeDimensions.paddingSizeDefault),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${record.formattedDate} ${record.formattedTime}',
                  style: ThemeTextStyles.caption1.copyWith(
                    color: ThemeColors.secondaryLabel,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacing4),
                Text(
                  description,
                  style: ThemeTextStyles.subhead.copyWith(
                    color: ThemeColors.label,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
