import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    void navigate(String route) {
      Navigator.pop(context);
      Navigator.pushNamedAndRemoveUntil(context, route, (route) => false);
    }

    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              accountName: Text(appState.user?.name ?? 'Guest'),
              accountEmail: Text(appState.user?.phone ?? 'Not signed in'),
              currentAccountPicture: CircleAvatar(
                backgroundImage: NetworkImage(
                  appState.user?.avatar ??
                      'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.map_outlined),
              title: Text(appState.t('drawer.map')),
              onTap: () => navigate('/map'),
            ),
            ListTile(
              leading: const Icon(Icons.people_outline),
              title: Text(appState.t('drawer.friends')),
              onTap: () => navigate('/friends'),
            ),
            ListTile(
              leading: const Icon(Icons.route_outlined),
              title: Text(appState.t('drawer.history')),
              onTap: () => navigate('/history'),
            ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: Text(appState.t('drawer.profile')),
              onTap: () => navigate('/profile'),
            ),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: Text(appState.t('drawer.about')),
              onTap: () => navigate('/about'),
            ),
            const Divider(),
            SwitchListTile(
              title: const Text('Dark theme'),
              value: appState.themeMode == ThemeMode.dark,
              onChanged: (_) => appState.toggleTheme(),
            ),
            ListTile(
              leading: const Icon(Icons.language),
              title: const Text('Language'),
              subtitle: Text(appState.language.toUpperCase()),
              onTap: () {
                final nextLang = appState.language == 'zh' ? 'en' : 'zh';
                appState.setLanguage(nextLang);
              },
            ),
          ],
        ),
      ),
    );
  }
}
