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
import 'package:qyflutter/apps/app_example/controller_app_example/auth_controller_app_example.dart';
import 'package:qyflutter/apps/app_example/controller_app_example/settings_controller_app_example.dart';
import 'package:qyflutter/apps/app_example/features_app_example/common_widgets/settings_item/settings_arrow_item.dart';
import 'package:qyflutter/apps/app_example/features_app_example/common_widgets/settings_item/settings_badge_item.dart';
import 'package:qyflutter/apps/app_example/features_app_example/common_widgets/settings_item/settings_dropdown_item.dart';
import 'package:qyflutter/apps/app_example/features_app_example/common_widgets/settings_item/settings_group.dart';
import 'package:qyflutter/apps/app_example/features_app_example/common_widgets/settings_item/settings_switch_item.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';

class SettingScreenView extends StatefulWidget {
  const SettingScreenView({super.key});

  @override
  State<SettingScreenView> createState() => _SettingScreenViewState();
}

class _SettingScreenViewState extends State<SettingScreenView> {
  bool _notifications = true;
  bool _biometricAuth = false;

  void _handleLogout(context) async {
    final authController = AuthControllerAppExample(context);
    try {
      await authController.logout();
      context.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('logout_success'.tr(context)),
          backgroundColor: Theme.of(context).colorScheme.primary,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          action: SnackBarAction(
            label: 'OK',
            textColor: Theme.of(context).colorScheme.onPrimary,
            onPressed: () {
              context.push(ExampleAppRoutesProvider.routeHome);
            },
          ),
        ),
      );
      Future.delayed(const Duration(seconds: 2), () {
        context.push(ExampleAppRoutesProvider.routeHome);
      });
    } catch (e) {
      context.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('logout_failed'.tr(context)),
          backgroundColor: Theme.of(context).colorScheme.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final settingsController = Provider.of<SettingsControllerAppExample>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('settings'.tr(context)),
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
              title: 'account_settings'.tr(context),
              items: [
                SettingsArrowItem(
                  icon: Icons.person,
                  title: 'profile'.tr(context),
                  onTap: () => context.push(ExampleAppRoutesProvider.routeProfile),
                ),
                SettingsArrowItem(
                  icon: Icons.security,
                  title: 'privacy_security'.tr(context),
                  // Note: routeSecuritySettings doesn't exist, using routeSecurity instead
                  onTap: () => context.push(ExampleAppRoutesProvider.routeSecurity),
                ),
                SettingsSwitchItem(
                  icon: Icons.fingerprint,
                  title: 'biometric_auth'.tr(context),
                  value: _biometricAuth,
                  onChanged: (value) => setState(() => _biometricAuth = value),
                ),
              ],
            ),

            // App Settings Group
            SettingsGroup(
              title: 'app_settings'.tr(context),
              items: [
                SettingsSwitchItem(
                  icon: Icons.dark_mode,
                  title: 'dark_mode'.tr(context),
                  value: settingsController.isDarkMode,
                  onChanged: (value) => settingsController.toggleTheme(),
                ),
                SettingsSwitchItem(
                  icon: Icons.notifications,
                  title: 'notifications'.tr(context),
                  value: _notifications,
                  onChanged: (value) => setState(() => _notifications = value),
                ),
                SettingsDropdownItem<String>(
                  icon: Icons.language,
                  title: 'language'.tr(context),
                  value: settingsController.getCurrentLocaleIdentifier(),
                  items: [
                    DropdownMenuItem(
                      value: 'en',
                      child: Text('language_english'.tr(context)),
                    ),
                    DropdownMenuItem(
                      value: 'zh',
                      child: Text('language_chinese'.tr(context)),
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
              title: 'support'.tr(context),
              items: [
                SettingsArrowItem(
                  icon: Icons.help_outline,
                  title: 'help_support'.tr(context),
                  onTap: () => context.push(ExampleAppRoutesProvider.routeHelp),
                ),
                SettingsArrowItem(
                  icon: Icons.info_outline,
                  title: 'about'.tr(context),
                  // Note: routeAbout doesn't exist, using routeHelp instead
                  onTap: () => context.push(ExampleAppRoutesProvider.routeHelp),
                ),
                SettingsBadgeItem(
                  icon: Icons.update,
                  title: 'app_version'.tr(context),
                  badge: '1.0.0',
                  onTap: () {},
                ),
              ],
            ),

            // Social Group
            SettingsGroup(
              title: 'social'.tr(context),
              items: [
                SettingsArrowItem(
                  icon: Icons.people,
                  title: 'invite_friends'.tr(context),
                  // Note: routeInviteFriends doesn't exist, using routeHelp as placeholder
                  onTap: () => context.push(ExampleAppRoutesProvider.routeHelp),
                ),
                SettingsArrowItem(
                  icon: Icons.share,
                  title: 'share_app'.tr(context),
                  onTap: () {},
                ),
              ],
            ),

            // Logout Button
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: SettingsArrowItem(
                icon: Icons.logout,
                title: 'logout'.tr(context),
                iconColor: Theme.of(context).colorScheme.error,
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: Text('logout_confirm'.tr(context)),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text('cancel'.tr(context)),
                        ),
                        TextButton(
                          onPressed: () => _handleLogout(context),
                          child: Text('yes_logout'.tr(context)),
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
