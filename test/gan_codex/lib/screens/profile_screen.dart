import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../widgets/app_drawer.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final user = appState.user;

    final body = user == null
        ? const Center(child: Text('Not signed in'))
        : Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
            ListTile(
              leading: CircleAvatar(
                backgroundImage: NetworkImage(user.avatar),
                radius: 32,
              ),
              title: Text(user.name, style: Theme.of(context).textTheme.titleLarge),
              subtitle: Text(user.signature),
            ),
            const SizedBox(height: 24),
            _InfoRow(label: 'Phone', value: user.phone),
            _InfoRow(label: 'Address', value: user.address),
            _InfoRow(label: 'Email', value: user.email),
            _InfoRow(label: 'ID', value: user.idCard),
            const Spacer(),
            FilledButton.icon(
              onPressed: () => Navigator.pushNamed(context, '/profile/edit'),
              icon: const Icon(Icons.edit_outlined),
              label: Text(appState.t('profile.edit')),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => Navigator.pushNamed(context, '/about'),
              icon: const Icon(Icons.info_outline),
              label: Text(appState.t('profile.about')),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () {
                appState.logout();
                Navigator.pushNamedAndRemoveUntil(
                    context, '/login', (route) => false);
              },
              icon: const Icon(Icons.logout),
              label: Text(appState.t('profile.logout')),
            ),
          ],
        ),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      drawer: const AppDrawer(),
      body: body,
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(value),
    );
  }
}
