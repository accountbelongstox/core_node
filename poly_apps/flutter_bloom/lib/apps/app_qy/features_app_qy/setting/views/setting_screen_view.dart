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
import 'package:qyflutter/apps/app_qy/controller_app_qy/auth_controller_app_qy.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/settings_controller_app_qy.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/common_widgets/settings_item/settings_arrow_item.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/common_widgets/settings_item/settings_badge_item.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/common_widgets/settings_item/settings_dropdown_item.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/common_widgets/settings_item/settings_group.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/common_widgets/settings_item/settings_switch_item.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';

class SettingScreenView extends StatefulWidget {
  const SettingScreenView({super.key});

  @override
  State<SettingScreenView> createState() => _SettingScreenViewState();
}

class _SettingScreenViewState extends State<SettingScreenView> {
  bool _notifications = true;
  bool _biometricAuth = false;

  void _handleLogout(context) async {
    final authController = AuthControllerAppQy(context);
    try {
      await authController.logout();
      context.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(QyAppLocalizationKeys.qyLogoutSuccess.tr(context)),
          backgroundColor: Theme.of(context).colorScheme.primary,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          action: SnackBarAction(
            label: QyAppLocalizationKeys.qyOk.tr(context),
            textColor: Theme.of(context).colorScheme.onPrimary,
            onPressed: () {
              context.push(QyAppRoutesProvider.routeHome);
            },
          ),
        ),
      );
      Future.delayed(const Duration(seconds: 2), () {
        context.push(QyAppRoutesProvider.routeHome);
      });
    } catch (e) {
      context.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(QyAppLocalizationKeys.qyLogoutFailed.tr(context)),
          backgroundColor: Theme.of(context).colorScheme.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final settingsController = Provider.of<SettingsControllerAppQy>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(QyAppLocalizationKeys.qySettings.tr(context)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Account Settings Group
            SettingsGroup(
              title: QyAppLocalizationKeys.qyAccountSettings.tr(context),
              items: [
                SettingsArrowItem(
                  icon: Icons.person,
                  title: QyAppLocalizationKeys.qyProfile.tr(context),
                  onTap: () => context.push(QyAppRoutesProvider.routeProfile),
                ),
                SettingsArrowItem(
                  icon: Icons.security,
                  title: QyAppLocalizationKeys.qyPrivacySecurity.tr(context),
                  // Note: routeSecuritySettings doesn't exist, using routeSecurity instead
                  onTap: () => context.push(QyAppRoutesProvider.routeSecurity),
                ),
                SettingsSwitchItem(
                  icon: Icons.fingerprint,
                  title: QyAppLocalizationKeys.qyBiometricAuth.tr(context),
                  value: _biometricAuth,
                  onChanged: (value) => setState(() => _biometricAuth = value),
                ),
              ],
            ),

            // App Settings Group
            SettingsGroup(
              title: QyAppLocalizationKeys.qyAppSettings.tr(context),
              items: [
                SettingsSwitchItem(
                  icon: Icons.dark_mode,
                  title: QyAppLocalizationKeys.qyDarkMode.tr(context),
                  value: settingsController.isDarkMode,
                  onChanged: (value) => settingsController.toggleTheme(),
                ),
                SettingsSwitchItem(
                  icon: Icons.notifications,
                  title: QyAppLocalizationKeys.qyNotifications.tr(context),
                  value: _notifications,
                  onChanged: (value) => setState(() => _notifications = value),
                ),
                SettingsDropdownItem<String>(
                  icon: Icons.language,
                  title: QyAppLocalizationKeys.qyLanguage.tr(context),
                  value: settingsController.getCurrentLocaleIdentifier(),
                  items: [
                    DropdownMenuItem(
                      value: 'en',
                      child: Text(QyAppLocalizationKeys.qyLanguageEnglish.tr(context)),
                    ),
                    DropdownMenuItem(
                      value: 'zh',
                      child: Text(QyAppLocalizationKeys.qyLanguageChinese.tr(context)),
                    ),
                  ],
                  onChanged: (value) async {
                    if (value != null) {
                      await settingsController.changeLanguage(value);
                    }
                  },
                ),
              ],
            ),

            // Support Group
            SettingsGroup(
              title: QyAppLocalizationKeys.qySupport.tr(context),
              items: [
                SettingsArrowItem(
                  icon: Icons.help_outline,
                  title: QyAppLocalizationKeys.qyHelpSupport.tr(context),
                  onTap: () => context.push(QyAppRoutesProvider.routeHelp),
                ),
                SettingsArrowItem(
                  icon: Icons.info_outline,
                  title: QyAppLocalizationKeys.qyAbout.tr(context),
                  // Note: routeAbout doesn't exist, using routeHelp instead
                  onTap: () => context.push(QyAppRoutesProvider.routeHelp),
                ),
                SettingsBadgeItem(
                  icon: Icons.update,
                  title: QyAppLocalizationKeys.qyAppVersion.tr(context),
                  badge: '1.0.0',
                  onTap: () {},
                ),
              ],
            ),

            // Social Group
            SettingsGroup(
              title: QyAppLocalizationKeys.qySocial.tr(context),
              items: [
                SettingsArrowItem(
                  icon: Icons.people,
                  title: QyAppLocalizationKeys.qyInviteFriends.tr(context),
                  // Note: routeInviteFriends doesn't exist, using routeHelp as placeholder
                  onTap: () => context.push(QyAppRoutesProvider.routeHelp),
                ),
                SettingsArrowItem(
                  icon: Icons.share,
                  title: QyAppLocalizationKeys.qyShareApp.tr(context),
                  onTap: () {},
                ),
              ],
            ),

            // Logout Button
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: SettingsArrowItem(
                icon: Icons.logout,
                title: QyAppLocalizationKeys.qyLogout.tr(context),
                iconColor: Theme.of(context).colorScheme.error,
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: Text(QyAppLocalizationKeys.qyLogoutConfirm.tr(context)),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text(QyAppLocalizationKeys.qyCancel.tr(context)),
                        ),
                        TextButton(
                          onPressed: () => _handleLogout(context),
                          child: Text(QyAppLocalizationKeys.qyYesLogout.tr(context)),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
