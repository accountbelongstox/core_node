import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../localization_app_codemart/localization_keys_app_codemart.dart';
import '../main_app_codemart.dart';
import '../models_app_codemart/user_model_app_codemart.dart';
import '../router_app_codemart/router_app_codemart.dart';

class HomeViewAppCodemart extends StatelessWidget {
  const HomeViewAppCodemart({super.key});

  @override
  Widget build(BuildContext context) {
    final userModel = context.watch<UserModelAppCodemart>();
    final isDeveloper = userModel.isDeveloper;
    final isClient = userModel.isClient;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr(LocalizationKeysAppCodemart.codemartAppName)),
        actions: [
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () => RouterAppCodemart.goToProfile(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr(LocalizationKeysAppCodemart.codemartWelcome),
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      userModel.userProfile?.username ?? 'User',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Quick actions
            Text(
              'Quick Actions',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),

            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              children: [
                if (isDeveloper)
                  _QuickActionCard(
                    icon: Icons.work,
                    title: context.tr(LocalizationKeysAppCodemart.codemartTaskHall),
                    onTap: () => RouterAppCodemart.goToTaskHall(context),
                  ),
                if (isDeveloper)
                  _QuickActionCard(
                    icon: Icons.assignment,
                    title: context.tr(LocalizationKeysAppCodemart.codemartTasks),
                    onTap: () => RouterAppCodemart.goToMyTasks(context),
                  ),
                if (isClient)
                  _QuickActionCard(
                    icon: Icons.add_circle,
                    title: context.tr(LocalizationKeysAppCodemart.codemartCreateProject),
                    onTap: () => RouterAppCodemart.goToCreateProject(context),
                  ),
                _QuickActionCard(
                  icon: Icons.folder,
                  title: context.tr(LocalizationKeysAppCodemart.codemartProjects),
                  onTap: () => RouterAppCodemart.goToProjects(context),
                ),
                _QuickActionCard(
                  icon: Icons.account_balance_wallet,
                  title: context.tr(LocalizationKeysAppCodemart.codemartWallet),
                  onTap: () => RouterAppCodemart.goToWallet(context),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 48),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
