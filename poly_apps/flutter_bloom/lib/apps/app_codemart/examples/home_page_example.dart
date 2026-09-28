/// Example: How to use AppDataCenter in Home Page
///
/// This example shows how to properly access user data in the home page
/// after successful login.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models_app_codemart/app_data_center_app_codemart.dart';
import '../config_app_codemart/debug_config_app_codemart.dart';

/// Example Home Page that uses AppDataCenter
class HomePageExampleAppCodemart extends StatefulWidget {
  const HomePageExampleAppCodemart({super.key});

  @override
  State<HomePageExampleAppCodemart> createState() => _HomePageExampleAppCodemartState();
}

class _HomePageExampleAppCodemartState extends State<HomePageExampleAppCodemart> {
  @override
  void initState() {
    super.initState();

    // Log user state when page loads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final dataCenter = context.read<AppDataCenterAppCodemart>();
      if (DebugConfigAppCodemart.enableDebugLogging) {
        debugPrint('HomePage: Loaded with user state');
        debugPrint('HomePage: Is logged in: ${dataCenter.isLoggedIn}');
        debugPrint('HomePage: User email: ${dataCenter.userProfile?.email}');
        debugPrint('HomePage: User mode: ${dataCenter.currentUserMode.name}');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CodeMart Home'),
        actions: [
          // User avatar
          Consumer<AppDataCenterAppCodemart>(
            builder: (context, dataCenter, child) {
              if (!dataCenter.isLoggedIn) {
                return const SizedBox.shrink();
              }
              return Padding(
                padding: const EdgeInsets.all(8.0),
                child: _buildUserAvatar(dataCenter),
              );
            },
          ),
        ],
      ),
      body: Consumer<AppDataCenterAppCodemart>(
        builder: (context, dataCenter, child) {
          if (!dataCenter.isLoggedIn) {
            return const Center(
              child: Text('Please login first'),
            );
          }

          // Display different content based on user role
          if (dataCenter.isDeveloper) {
            return _buildDeveloperHome(dataCenter);
          } else if (dataCenter.isClient) {
            return _buildClientHome(dataCenter);
          } else {
            return const Center(
              child: Text('Unknown user role'),
            );
          }
        },
      ),
      floatingActionButton: Consumer<AppDataCenterAppCodemart>(
        builder: (context, dataCenter, child) {
          if (dataCenter.isDebugMode) {
            return FloatingActionButton.extended(
              onPressed: () => _showDebugInfo(context, dataCenter),
              icon: const Icon(Icons.bug_report),
              label: const Text('Debug Info'),
              backgroundColor: Colors.orange,
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildUserAvatar(AppDataCenterAppCodemart dataCenter) {
    final user = dataCenter.userProfile!;

    if (user.avatar != null) {
      return CircleAvatar(
        backgroundImage: NetworkImage(user.avatar!),
      );
    }

    return CircleAvatar(
      backgroundColor: Theme.of(context).colorScheme.primary,
      child: Text(
        user.name[0].toUpperCase(),
        style: const TextStyle(color: Colors.white),
      ),
    );
  }

  Widget _buildDeveloperHome(AppDataCenterAppCodemart dataCenter) {
    final user = dataCenter.userProfile!;
    final devProfile = dataCenter.developerProfile!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Welcome Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome back, ${user.name}!',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    user.email,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Developer Stats Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.code),
                      const SizedBox(width: 8),
                      Text(
                        'Developer Dashboard',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  _buildStatRow('Level', devProfile.level.name),
                  _buildStatRow('Points', '${devProfile.points}'),
                  _buildStatRow('Completed Projects', '${devProfile.completedProjects}'),
                  _buildStatRow('Rating', '${devProfile.rating.toStringAsFixed(1)} ⭐'),
                  _buildStatRow('Followers', '${devProfile.followersCount}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Skills Card
          if (devProfile.skills.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Skills',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: devProfile.skills
                          .map((skill) => Chip(label: Text(skill)))
                          .toList(),
                    ),
                  ],
                ),
              ),
            ),

          // Debug Mode Indicator
          if (dataCenter.isDebugMode)
            Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                border: Border.all(color: Colors.orange, width: 2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.bug_report, color: Colors.orange),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'DEBUG MODE ACTIVE',
                          style: TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Using mock data',
                          style: TextStyle(
                            color: Colors.orange.shade700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildClientHome(AppDataCenterAppCodemart dataCenter) {
    final user = dataCenter.userProfile!;
    final clientProfile = dataCenter.clientProfile!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Welcome Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome back, ${user.name}!',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    clientProfile.companyName,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    user.email,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Client Stats Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.business),
                      const SizedBox(width: 8),
                      Text(
                        'Client Dashboard',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  _buildStatRow('Level', clientProfile.level.name),
                  _buildStatRow('Posted Projects', '${clientProfile.postedProjects}'),
                  _buildStatRow('Total Projects', '${clientProfile.totalProjects}'),
                  _buildStatRow('Total Spent', '\$${clientProfile.totalSpent.toStringAsFixed(2)}'),
                  _buildStatRow('Rating', '${clientProfile.rating.toStringAsFixed(1)} ⭐'),
                ],
              ),
            ),
          ),

          // Debug Mode Indicator
          if (dataCenter.isDebugMode)
            Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                border: Border.all(color: Colors.orange, width: 2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.bug_report, color: Colors.orange),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'DEBUG MODE ACTIVE',
                          style: TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Using mock data',
                          style: TextStyle(
                            color: Colors.orange.shade700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          Text(
            value,
            style: const TextStyle(color: Colors.grey),
          ),
        ],
      ),
    );
  }

  void _showDebugInfo(BuildContext context, AppDataCenterAppCodemart dataCenter) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Debug Information'),
        content: SingleChildScrollView(
          child: Text(dataCenter.getDebugInfo()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          TextButton(
            onPressed: () async {
              await dataCenter.logout();
              if (context.mounted) {
                Navigator.pop(context);
                // Navigate to login
              }
            },
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}
