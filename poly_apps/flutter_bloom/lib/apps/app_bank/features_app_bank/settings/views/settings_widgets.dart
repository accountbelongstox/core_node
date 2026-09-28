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
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../managers_app_bank/license_registration_manager.dart';
import 'data_management_screen.dart';
import 'settings_dialogs.dart';

class SettingsWidgets {
  static Widget buildUserSection(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final user = provider.user;
        final licenseManager = LicenseRegistrationManager();
        final isSuperUser = licenseManager.isSuperUser;

        return Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF74B9FF), Color(0xFF0984E3)],
            ),
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          ),
          child: Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius:
                      BorderRadius.circular(BankConstants.borderRadius),
                ),
                child: const Center(
                  child: Icon(
                    Icons.person,
                    size: 50,
                    color: Colors.white,
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
                        Expanded(
                          child: Text(
                            provider.globalData?.fullName ??
                                user?.maskedName ??
                                BankLocalizationKeys.bankUnknownUser.tr(context),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        if (isSuperUser)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.amber,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              '超级用户',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      provider.globalData?.location ??
                          provider.globalData?.city ??
                          user?.location ??
                          BankLocalizationKeys.bankUnknownLocation.tr(context),
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

  static Widget buildSettingsSection(BuildContext context) {
    final licenseManager = LicenseRegistrationManager();
    final isSuperUser = licenseManager.isSuperUser;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
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
          buildSettingsItem(
            context,
            icon: Icons.account_circle_outlined,
            title: BankLocalizationKeys.bankAccountManagement.tr(context),
            subtitle: '修改手机号、银行卡、余额等',
            onTap: () {
              final provider =
                  Provider.of<BankUserProvider>(context, listen: false);
              if (!provider.isAuthenticated) {
                GoRouter.of(context).push(BankConstants.routeAuthentication);
                return;
              }
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const DataManagementScreen(),
                ),
              );
            },
          ),
          if (isSuperUser) ...[
            buildDivider(),
            buildSettingsItem(
              context,
              icon: Icons.star_outline,
              title:
                  BankLocalizationKeys.bankDebugMyExclusiveCustomer.tr(context),
              subtitle:
                  BankLocalizationKeys.bankDebugExclusiveServiceDesc.tr(context),
              onTap: () {
                GoRouter.of(context).push(BankConstants.routeExclusiveCustomer);
              },
              showArrow: true,
              isSpecial: true,
            ),
          ],
          buildDivider(),
          buildSettingsItem(
            context,
            icon: Icons.security_outlined,
            title: BankLocalizationKeys.bankSecuritySettings.tr(context),
            subtitle: BankLocalizationKeys.bankSecuritySettingsDesc.tr(context),
            onTap: () {
              SettingsDialogs.showFeatureNotAvailable(context);
            },
            isDisabled: true,
          ),
          buildDivider(),
          buildSettingsItem(
            context,
            icon: Icons.notifications_outlined,
            title: BankLocalizationKeys.bankNotificationSettings.tr(context),
            subtitle:
                BankLocalizationKeys.bankNotificationSettingsDesc.tr(context),
            onTap: () {
              SettingsDialogs.showFeatureNotAvailable(context);
            },
            isDisabled: true,
          ),
          buildDivider(),
          buildSettingsItem(
            context,
            icon: Icons.language_outlined,
            title: BankLocalizationKeys.bankLanguage.tr(context),
            subtitle: BankLocalizationKeys.bankLanguageSettings.tr(context),
            onTap: () {
              SettingsDialogs.showFeatureNotAvailable(context);
            },
            isDisabled: true,
          ),
        ],
      ),
    );
  }

  static Widget buildAboutSection(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
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
          buildSettingsItem(
            context,
            icon: Icons.info_outline,
            title: BankLocalizationKeys.bankAboutApp.tr(context),
            subtitle: '${BankConstants.appVersion}·开发者测试',
            onTap: () {
              SettingsDialogs.showAboutDialog(context);
            },
          ),
          buildDivider(),
          buildSettingsItem(
            context,
            icon: Icons.help_outline,
            title: BankLocalizationKeys.bankHelpCenter.tr(context),
            subtitle: BankLocalizationKeys.bankHelpCenterDesc.tr(context),
            onTap: () {
              SettingsDialogs.showFeatureNotAvailable(context);
            },
            isDisabled: true,
          ),
          buildDivider(),
          buildSettingsItem(
            context,
            icon: Icons.privacy_tip_outlined,
            title: BankLocalizationKeys.bankPrivacyPolicy.tr(context),
            subtitle: BankLocalizationKeys.bankPrivacyPolicyDesc.tr(context),
            onTap: () {
              SettingsDialogs.showFeatureNotAvailable(context);
            },
            isDisabled: true,
          ),
        ],
      ),
    );
  }

  static Widget buildSettingsItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool showArrow = true,
    bool isSpecial = false,
    bool isDisabled = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isDisabled
                    ? Colors.grey.withOpacity(0.1)
                    : isSpecial
                        ? const Color(0xFFFFD700).withOpacity(0.2)
                        : const Color(0xFF74B9FF).withOpacity(0.1),
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
              ),
              child: Center(
                child: Icon(
                  icon,
                  size: 20,
                  color: isDisabled
                      ? Colors.grey[400]
                      : isSpecial
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
                          color: isDisabled
                              ? Colors.grey[500]
                              : isSpecial
                                  ? const Color(0xFFFF8C00)
                                  : Colors.black87,
                        ),
                      ),
                      if (isSpecial) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFD700),
                            borderRadius: BorderRadius.circular(
                                BankConstants.borderRadius),
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
                      color: isDisabled ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            if (showArrow)
              Icon(
                Icons.arrow_forward_ios,
                size: 16,
                color: isDisabled ? Colors.grey[300] : Colors.grey[400],
              ),
          ],
        ),
      ),
    );
  }

  static Widget buildDivider() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      height: 1,
      color: Colors.grey[200],
    );
  }

  static Widget buildLogoutSection(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final user = provider.user;
        final isLoggedIn =
            user != null || provider.globalData?.fullName != null;

        if (!isLoggedIn) {
          return const SizedBox.shrink();
        }

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: InkWell(
            onTap: () {
              SettingsDialogs.showLogoutDialog(
                context,
                () {
                  provider.clearUser();
                  if (context.mounted) {
                    GoRouter.of(context).go(BankConstants.routeAuthentication);
                  }
                },
                () {
                  SettingsDialogs.showClearDataConfirmDialog(
                    context,
                    () async {
                      await provider.clearUserStorageData();
                      if (context.mounted) {
                        GoRouter.of(context).go(BankConstants.routeAuthentication);
                      }
                    },
                  );
                },
              );
            },
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.1),
                      borderRadius:
                          BorderRadius.circular(BankConstants.borderRadius),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.logout,
                        size: 20,
                        color: Colors.red,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  const Expanded(
                    child: Text(
                      '退出登录',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: Colors.red,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
