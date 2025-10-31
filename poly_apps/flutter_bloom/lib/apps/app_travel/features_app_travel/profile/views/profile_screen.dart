// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../router_app_travel/routes_provider_app_travel.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              context.push(TravelAppRoutesProvider.routeSettings);
            },
          ),
        ],
      ),
      body: Consumer<UserProviderAppTravel>(
        builder: (context, userProvider, child) {
          final user = userProvider.user;

          if (!userProvider.isLoggedIn) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.person_outline,
                    size: 100,
                    color: Colors.grey,
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Not logged in',
                    style: TextStyle(fontSize: 20),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      context.push(TravelAppRoutesProvider.routeLogin);
                    },
                    child: const Text('Login'),
                  ),
                ],
              ),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 50,
                  backgroundImage: user.avatarUrl != null
                      ? NetworkImage(user.avatarUrl!)
                      : null,
                  child: user.avatarUrl == null
                      ? Text(
                          user.username?.substring(0, 1).toUpperCase() ?? 'U',
                          style: const TextStyle(fontSize: 40),
                        )
                      : null,
                ),
                const SizedBox(height: 16),
                Text(
                  user.username ?? 'User',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (user.email != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    user.email!,
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.grey,
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                _buildInfoCard(
                  icon: Icons.location_city,
                  title: 'Current City',
                  value: user.currentCity ?? 'Not set',
                ),
                _buildInfoCard(
                  icon: Icons.favorite,
                  title: 'Favorites',
                  value: '${user.favorites?.length ?? 0} items',
                  onTap: () {
                    context.push(TravelAppRoutesProvider.routeFavorites);
                  },
                ),
                _buildInfoCard(
                  icon: Icons.bookmark,
                  title: 'Bookmarks',
                  value: '${user.bookmarks?.length ?? 0} items',
                  onTap: () {
                    context.push(TravelAppRoutesProvider.routeBookmarks);
                  },
                ),
                const SizedBox(height: 32),
                ListTile(
                  leading: const Icon(Icons.edit),
                  title: const Text('Edit Profile'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    _showEditProfileDialog(context, userProvider);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.logout, color: Colors.red),
                  title: const Text(
                    'Logout',
                    style: TextStyle(color: Colors.red),
                  ),
                  onTap: () async {
                    await userProvider.logout();
                    if (context.mounted) {
                      context.go(TravelAppRoutesProvider.routeLogin);
                    }
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required String title,
    required String value,
    VoidCallback? onTap,
  }) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            if (onTap != null) ...[
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right, size: 20),
            ],
          ],
        ),
        onTap: onTap,
      ),
    );
  }

  void _showEditProfileDialog(
    BuildContext context,
    UserProviderAppTravel userProvider,
  ) {
    final TextEditingController usernameController = TextEditingController(
      text: userProvider.user.username,
    );
    final TextEditingController emailController = TextEditingController(
      text: userProvider.user.email,
    );
    final TextEditingController cityController = TextEditingController(
      text: userProvider.user.currentCity,
    );

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Edit Profile'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: usernameController,
                  decoration: const InputDecoration(
                    labelText: 'Username',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: cityController,
                  decoration: const InputDecoration(
                    labelText: 'Current City',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                await userProvider.updateProfile(
                  username: usernameController.text,
                  email: emailController.text,
                  currentCity: cityController.text,
                );
                if (context.mounted) {
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Profile updated successfully'),
                    ),
                  );
                }
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
  }
}
