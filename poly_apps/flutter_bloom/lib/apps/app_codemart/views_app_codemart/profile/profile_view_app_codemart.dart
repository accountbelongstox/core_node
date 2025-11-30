import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/user_model_app_codemart.dart';
import '../../router_app_codemart/router_app_codemart.dart';

class ProfileViewAppCodemart extends StatelessWidget {
  const ProfileViewAppCodemart({super.key});

  @override
  Widget build(BuildContext context) {
    final userModel = context.watch<UserModelAppCodemart>();
    final user = userModel.userProfile;
    final developer = userModel.developerProfile;
    final client = userModel.clientProfile;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr(LocalizationKeysAppCodemart.codemartProfile)),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () {
              // TODO: Navigate to edit profile
            },
          ),
        ],
      ),
      body: user == null
          ? Center(child: Text(context.tr(LocalizationKeysAppCodemart.codemartUserNotLoggedIn)))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Profile header
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 48,
                          child: Text(
                            user.username[0].toUpperCase(),
                            style: const TextStyle(fontSize: 32),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          user.username,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          user.email,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: user.roles.map((role) {
                            return Chip(label: Text(role.name));
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Developer profile section
                if (developer != null) ...[
                  Text(
                    context.tr(LocalizationKeysAppCodemart.codemartDeveloper),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _InfoRow(
                            icon: Icons.star,
                            label: 'Rating',
                            value: '${developer.rating.toStringAsFixed(1)} / 5.0',
                          ),
                          _InfoRow(
                            icon: Icons.verified,
                            label: 'Verification',
                            value: developer.verificationStatus.name,
                          ),
                          const SizedBox(height: 8),
                          if (developer.skills.isNotEmpty) ...[
                            const Text(
                              'Skills',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: developer.skills.map((skill) {
                                return Chip(label: Text(skill));
                              }).toList(),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Client profile section
                if (client != null) ...[
                  Text(
                    context.tr(LocalizationKeysAppCodemart.codemartClient),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _InfoRow(
                            icon: Icons.business,
                            label: 'Company',
                            value: client.companyName ?? 'Not specified',
                          ),
                          _InfoRow(
                            icon: Icons.verified,
                            label: 'Verification',
                            value: client.verificationStatus.name,
                          ),
                          _InfoRow(
                            icon: Icons.folder,
                            label: 'Total Projects',
                            value: client.totalProjects.toString(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Settings section
                Text(
                  context.tr(LocalizationKeysAppCodemart.codemartSettings),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.account_balance_wallet),
                        title: Text(context.tr(LocalizationKeysAppCodemart.codemartWallet)),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => RouterAppCodemart.goToWallet(context),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.notifications),
                        title: Text(context.tr(LocalizationKeysAppCodemart.codemartNotifications)),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          // TODO: Navigate to notifications settings
                        },
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.language),
                        title: Text(context.tr(LocalizationKeysAppCodemart.codemartLanguage)),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          // TODO: Navigate to language settings
                        },
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.logout, color: Colors.red),
                        title: Text(
                          context.tr(LocalizationKeysAppCodemart.codemartLogout),
                          style: const TextStyle(color: Colors.red),
                        ),
                        onTap: () {
                          userModel.logout();
                          RouterAppCodemart.goToLogin(context);
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}
