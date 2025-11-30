import 'package:flutter/material.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../router_app_codemart/router_app_codemart.dart';

class SettingsViewAppCodemart extends StatelessWidget {
  const SettingsViewAppCodemart({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr(LocalizationKeysAppCodemart.codemartSettings)),
      ),
      body: ListView(
        children: [
          _SettingsSection(
            title: context.tr(LocalizationKeysAppCodemart.codemartAccount),
            children: [
              ListTile(
                leading: const Icon(Icons.person),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartProfile)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartEditProfileInfo)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToProfile(context),
              ),
              ListTile(
                leading: const Icon(Icons.account_balance_wallet),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartWallet)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartManagePaymentsTransactions)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToWallet(context),
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: context.tr(LocalizationKeysAppCodemart.codemartPreferences),
            children: [
              ListTile(
                leading: const Icon(Icons.notifications),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartNotifications)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartManageNotificationPreferences)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToNotificationSettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.language),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartLanguage)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartChangeAppLanguage)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToLanguageSettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.dark_mode),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartTheme)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartLightDarkSystem)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Show theme selector dialog
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: context.tr(LocalizationKeysAppCodemart.codemartPrivacySecurity),
            children: [
              ListTile(
                leading: const Icon(Icons.privacy_tip),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartPrivacy)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartManagePrivacySettings)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToPrivacySettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.lock),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartSecurity)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartPasswordAuthentication)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Navigate to security settings
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: context.tr(LocalizationKeysAppCodemart.codemartSupport),
            children: [
              ListTile(
                leading: const Icon(Icons.help),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartHelpSupport)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartFaqsContactSupport)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToHelp(context),
              ),
              ListTile(
                leading: const Icon(Icons.info),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartAbout)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartAppVersionInfo)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToAbout(context),
              ),
              ListTile(
                leading: const Icon(Icons.description),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartTermsConditions)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Show terms and conditions
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: context.tr(LocalizationKeysAppCodemart.codemartApp),
            children: [
              ListTile(
                leading: const Icon(Icons.cached),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartClearCache)),
                subtitle: Text(context.tr(LocalizationKeysAppCodemart.codemartFreeUpStorage)),
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: Text(context.tr(LocalizationKeysAppCodemart.codemartClearCache)),
                      content: Text(context.tr(LocalizationKeysAppCodemart.codemartClearCacheConfirm)),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text(context.tr(LocalizationKeysAppCodemart.codemartCancel)),
                        ),
                        FilledButton(
                          onPressed: () {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(context.tr(LocalizationKeysAppCodemart.codemartCacheCleared))),
                            );
                          },
                          child: Text(context.tr(LocalizationKeysAppCodemart.codemartConfirm)),
                        ),
                      ],
                    ),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.bug_report),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartReportBug)),
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
