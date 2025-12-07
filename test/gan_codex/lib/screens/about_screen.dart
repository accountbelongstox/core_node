import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../widgets/app_drawer.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      drawer: const AppDrawer(),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('SafeGuardian',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            const Text(
              'SafeGuardian is a concept safety companion that mirrors the'
              ' HoloFortune UI built in React. This Flutter rewrite focuses on'
              ' showcasing navigation, shared state, and theming.',
            ),
            const SizedBox(height: 24),
            Text('Current language: ${appState.language.toUpperCase()}'),
            const SizedBox(height: 8),
            Text('Theme: ${appState.themeMode.name}'),
          ],
        ),
      ),
    );
  }
}
