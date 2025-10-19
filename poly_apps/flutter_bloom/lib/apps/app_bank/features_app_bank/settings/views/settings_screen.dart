// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../../localization_app_bank/localization_keys_app_bank.dart';
import '../../../config_app_bank/constants.dart';

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
            _buildUserSection(context),
            const SizedBox(height: 16),
            _buildSettingsSection(context),
            const SizedBox(height: 16),
            _buildAboutSection(context),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildUserSection(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final user = provider.user;
        return Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF74B9FF), Color(0xFF0984E3)],
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: const Center(
                  child: Icon(
                    Icons.person,
                    size: 30,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user?.maskedName ?? BankLocalizationKeys.bankUnknownUser.tr(context),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user?.location ?? BankLocalizationKeys.bankUnknownLocation.tr(context),
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withOpacity(0.8),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${BankLocalizationKeys.bankLastLogin.tr(context)}: ${provider.formattedLastLoginTime}',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withOpacity(0.7),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSettingsSection(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildSettingsItem(
            context,
            icon: Icons.account_circle_outlined,
            title: BankLocalizationKeys.bankAccountManagement.tr(context),
            subtitle: BankLocalizationKeys.bankAccountManagementDesc.tr(context),
            onTap: () {
              // TODO: Navigate to account management
            },
          ),
          _buildDivider(),
          _buildSettingsItem(
            context,
            icon: Icons.security_outlined,
            title: BankLocalizationKeys.bankSecuritySettings.tr(context),
            subtitle: BankLocalizationKeys.bankSecuritySettingsDesc.tr(context),
            onTap: () {
              // TODO: Navigate to security settings
            },
          ),
          _buildDivider(),
          _buildSettingsItem(
            context,
            icon: Icons.notifications_outlined,
            title: BankLocalizationKeys.bankNotificationSettings.tr(context),
            subtitle: BankLocalizationKeys.bankNotificationSettingsDesc.tr(context),
            onTap: () {
              // TODO: Navigate to notification settings
            },
          ),
          _buildDivider(),
          _buildSettingsItem(
            context,
            icon: Icons.language_outlined,
            title: BankLocalizationKeys.bankLanguage.tr(context),
            subtitle: BankLocalizationKeys.bankLanguageSettings.tr(context),
            onTap: () {
              // TODO: Navigate to language settings
            },
          ),
          _buildDivider(),
          _buildSettingsItem(
            context,
            icon: Icons.star_outline,
            title: BankLocalizationKeys.bankDebugMyExclusiveCustomer.tr(context),
            subtitle: BankLocalizationKeys.bankDebugExclusiveServiceDesc.tr(context),
            onTap: () {
              context.push(BankConstants.routeExclusiveCustomer);
            },
            showArrow: true,
            isSpecial: true,
          ),
        ],
      ),
    );
  }

  Widget _buildAboutSection(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildSettingsItem(
            context,
            icon: Icons.help_outline,
            title: BankLocalizationKeys.bankHelpCenter.tr(context),
            subtitle: BankLocalizationKeys.bankHelpCenterDesc.tr(context),
            onTap: () {
              // TODO: Navigate to help center
            },
          ),
          _buildDivider(),
          _buildSettingsItem(
            context,
            icon: Icons.info_outline,
            title: BankLocalizationKeys.bankAboutApp.tr(context),
            subtitle: BankLocalizationKeys.bankAboutAppDesc.tr(context),
            onTap: () {
              _showAboutDialog(context);
            },
          ),
          _buildDivider(),
          _buildSettingsItem(
            context,
            icon: Icons.privacy_tip_outlined,
            title: BankLocalizationKeys.bankPrivacyPolicy.tr(context),
            subtitle: BankLocalizationKeys.bankPrivacyPolicyDesc.tr(context),
            onTap: () {
              // TODO: Navigate to privacy policy
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool showArrow = true,
    bool isSpecial = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isSpecial
                    ? const Color(0xFFFFD700).withOpacity(0.2)
                    : const Color(0xFF74B9FF).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Icon(
                  icon,
                  size: 20,
                  color: isSpecial
                      ? const Color(0xFFFF8C00)
                      : const Color(0xFF74B9FF),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: isSpecial
                              ? const Color(0xFFFF8C00)
                              : Colors.black87,
                        ),
                      ),
                      if (isSpecial) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFD700),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'VIP',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            if (showArrow)
              Icon(
                Icons.arrow_forward_ios,
                size: 16,
                color: Colors.grey[400],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      height: 1,
      color: Colors.grey[200],
    );
  }

  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(BankLocalizationKeys.bankAboutApp.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${BankLocalizationKeys.bankDebugAppVersion.tr(context)}: ${BankConstants.appVersion}'),
            const SizedBox(height: 8),
            const Text('Developer: Flutter Team'),
            const SizedBox(height: 8),
            const Text('© 2024 Bank App. All rights reserved.'),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                Navigator.pop(context);
                context.push(BankConstants.routeDeveloperFeedback);
              },
              child: Text(
                BankLocalizationKeys.bankAboutAppDesc.tr(context),
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[500],
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(BankLocalizationKeys.bankConfirm.tr(context)),
          ),
        ],
      ),
    );
  }
}
