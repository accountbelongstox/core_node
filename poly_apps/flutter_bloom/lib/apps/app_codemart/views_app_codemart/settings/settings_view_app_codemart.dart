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
            title: 'Account',
            children: [
              ListTile(
                leading: const Icon(Icons.person),
                title: const Text('Profile'),
                subtitle: const Text('Edit your profile information'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToProfile(context),
              ),
              ListTile(
                leading: const Icon(Icons.account_balance_wallet),
                title: Text(context.tr(LocalizationKeysAppCodemart.codemartWallet)),
                subtitle: const Text('Manage payments and transactions'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToWallet(context),
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: 'Preferences',
            children: [
              ListTile(
                leading: const Icon(Icons.notifications),
                title: const Text('Notifications'),
                subtitle: const Text('Manage notification preferences'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToNotificationSettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.language),
                title: const Text('Language'),
                subtitle: const Text('Change app language'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToLanguageSettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.dark_mode),
                title: const Text('Theme'),
                subtitle: const Text('Light, Dark, or System'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Show theme selector dialog
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: 'Privacy & Security',
            children: [
              ListTile(
                leading: const Icon(Icons.privacy_tip),
                title: const Text('Privacy'),
                subtitle: const Text('Manage privacy settings'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToPrivacySettings(context),
              ),
              ListTile(
                leading: const Icon(Icons.lock),
                title: const Text('Security'),
                subtitle: const Text('Password and authentication'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Navigate to security settings
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: 'Support',
            children: [
              ListTile(
                leading: const Icon(Icons.help),
                title: const Text('Help & Support'),
                subtitle: const Text('FAQs and contact support'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToHelp(context),
              ),
              ListTile(
                leading: const Icon(Icons.info),
                title: const Text('About'),
                subtitle: const Text('App version and information'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => RouterAppCodemart.goToAbout(context),
              ),
              ListTile(
                leading: const Icon(Icons.description),
                title: const Text('Terms & Conditions'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Show terms and conditions
                },
              ),
            ],
          ),
          const Divider(),
          _SettingsSection(
            title: 'App',
            children: [
              ListTile(
                leading: const Icon(Icons.cached),
                title: const Text('Clear Cache'),
                subtitle: const Text('Free up storage space'),
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Clear Cache'),
                      content: const Text('Are you sure you want to clear app cache?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text(context.tr(LocalizationKeysAppCodemart.codemartCancel)),
                        ),
                        FilledButton(
                          onPressed: () {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Cache cleared')),
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
                title: const Text('Report a Bug'),
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
