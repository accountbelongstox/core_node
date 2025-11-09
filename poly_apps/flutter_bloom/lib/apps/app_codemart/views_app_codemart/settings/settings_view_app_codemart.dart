import 'package:flutter/material.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class SettingsViewAppCodemart extends StatelessWidget {
  const SettingsViewAppCodemart({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(LocalizationKeysAppCodemart.codemartSettings.tr(context)),
      ),
      body: ListView(
        children: [
          _SettingsSection(
            title: LocalizationKeysAppCodemart.codemartAccount.tr(context),
            children: [
              ListTile(
                leading: const Icon(Icons.person),
                title: Text(LocalizationKeysAppCodemart.codemartProfile.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartEditProfileInfo.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToProfile(context),
              ),
              ListTile(
                leading: const Icon(Icons.account_balance_wallet),
                title: Text(LocalizationKeysAppCodemart.codemartWallet.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartManagePaymentsTransactions.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToWallet(context),
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: LocalizationKeysAppCodemart.codemartPreferences.tr(context),
            children: [
              ListTile(
                leading: const Icon(Icons.notifications),
                title: Text(LocalizationKeysAppCodemart.codemartNotifications.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartManageNotificationPreferences.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToNotificationSettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.language),
                title: Text(LocalizationKeysAppCodemart.codemartLanguage.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartChangeAppLanguage.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToLanguageSettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.dark_mode),
                title: Text(LocalizationKeysAppCodemart.codemartTheme.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartLightDarkSystem.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Show theme selector dialog
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: LocalizationKeysAppCodemart.codemartPrivacySecurity.tr(context),
            children: [
              ListTile(
                leading: const Icon(Icons.privacy_tip),
                title: Text(LocalizationKeysAppCodemart.codemartPrivacy.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartManagePrivacySettings.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToPrivacySettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.lock),
                title: Text(LocalizationKeysAppCodemart.codemartSecurity.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartPasswordAuthentication.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Navigate to security settings
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: LocalizationKeysAppCodemart.codemartSupport.tr(context),
            children: [
              ListTile(
                leading: const Icon(Icons.help),
                title: Text(LocalizationKeysAppCodemart.codemartHelpSupport.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartFaqsContactSupport.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToHelp(context),
              ),
              ListTile(
                leading: const Icon(Icons.info),
                title: Text(LocalizationKeysAppCodemart.codemartAbout.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartAppVersionInfo.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToAbout(context),
              ),
              ListTile(
                leading: const Icon(Icons.description),
                title: Text(LocalizationKeysAppCodemart.codemartTermsConditions.tr(context)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Show terms and conditions
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: LocalizationKeysAppCodemart.codemartApp.tr(context),
            children: [
              ListTile(
                leading: const Icon(Icons.cached),
                title: Text(LocalizationKeysAppCodemart.codemartClearCache.tr(context)),
                subtitle: Text(LocalizationKeysAppCodemart.codemartFreeUpStorage.tr(context)),
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: Text(LocalizationKeysAppCodemart.codemartClearCache.tr(context)),
                      content: Text(LocalizationKeysAppCodemart.codemartClearCacheConfirm.tr(context)),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text(LocalizationKeysAppCodemart.codemartCancel.tr(context)),
                        ),
                        FilledButton(
                          onPressed: () {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(LocalizationKeysAppCodemart.codemartCacheCleared.tr(context))),
                            );
                          },
                          child: Text(LocalizationKeysAppCodemart.codemartConfirm.tr(context)),
                        ),
                      ],
                    ),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.bug_report),
                title: Text(LocalizationKeysAppCodemart.codemartReportBug.tr(context)),
                onTap: () {
                  // TODO: Open bug report form
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SettingsSection({
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.bold,
                ),
          ),
        ),
        ...children,
      ],
    );
  }
}
