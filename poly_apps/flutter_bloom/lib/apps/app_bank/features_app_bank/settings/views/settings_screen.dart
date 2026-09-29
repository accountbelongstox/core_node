import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_bank/localization_keys_app_bank.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'settings_widgets.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(
          BankLocalizationKeys.bankSettings.tr(context),
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF74B9FF),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            SettingsWidgets.buildUserSection(context),
            const SizedBox(height: 16),
            SettingsWidgets.buildSettingsSection(context),
            const SizedBox(height: 16),
            SettingsWidgets.buildAboutSection(context),
            const SizedBox(height: 16),
            SettingsWidgets.buildLogoutSection(context),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
