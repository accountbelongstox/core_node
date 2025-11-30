/// AppDataCenter Usage Examples
///
/// This file demonstrates various ways to use AppDataCenterAppCodemart
/// in your application.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models_app_codemart/app_data_center_app_codemart.dart';

/// Example 1: Basic usage - Displaying user information
class UserProfileWidget extends StatelessWidget {
  const UserProfileWidget({super.key});

  @override
  Widget build(BuildContext context) {
    // Watch for changes in AppDataCenter
    final dataCenter = context.watch<AppDataCenterAppCodemart>();

    // Check if user is logged in
    if (!dataCenter.isLoggedIn) {
      return const Center(
        child: Text('Please login first'),
      );
    }

    // Access user profile
    final user = dataCenter.userProfile!;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Name: ${user.name}'),
            Text('Email: ${user.email}'),
            Text('Username: ${user.username}'),
            if (dataCenter.isDeveloper)
              Text('Role: Developer (Level ${dataCenter.developerProfile?.level.name})'),
            if (dataCenter.isClient)
              Text('Role: Client (Level ${dataCenter.clientProfile?.level.name})'),
          ],
        ),
      ),
    );
  }
}

/// Example 2: Conditional rendering based on user role
class RoleBasedWidget extends StatelessWidget {
  const RoleBasedWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final dataCenter = context.watch<AppDataCenterAppCodemart>();

    // Show different UI based on user role
    if (dataCenter.isDeveloper) {
      return _buildDeveloperView(dataCenter);
    } else if (dataCenter.isClient) {
      return _buildClientView(dataCenter);
    } else {
      return const Center(child: Text('Unknown user role'));
    }
  }

  Widget _buildDeveloperView(AppDataCenterAppCodemart dataCenter) {
    final devProfile = dataCenter.developerProfile!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Developer Dashboard', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Text('Level: ${devProfile.level.name}'),
            Text('Points: ${devProfile.points}'),
            Text('Completed Projects: ${devProfile.completedProjects}'),
            Text('Rating: ${devProfile.rating.toStringAsFixed(1)}'),
            Text('Skills: ${devProfile.skills.join(", ")}'),
          ],
        ),
      ),
    );
  }

  Widget _buildClientView(AppDataCenterAppCodemart dataCenter) {
    final clientProfile = dataCenter.clientProfile!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Client Dashboard', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Text('Company: ${clientProfile.companyName}'),
            Text('Level: ${clientProfile.level.name}'),
            Text('Posted Projects: ${clientProfile.postedProjects}'),
            Text('Total Spent: \$${clientProfile.totalSpent.toStringAsFixed(2)}'),
            Text('Rating: ${clientProfile.rating.toStringAsFixed(1)}'),
          ],
        ),
      ),
    );
  }
}

/// Example 3: Using AppDataCenter without watching
class LogoutButton extends StatelessWidget {
  const LogoutButton({super.key});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () async {
        // Use read instead of watch for one-time operations
        final dataCenter = context.read<AppDataCenterAppCodemart>();

        // Show confirmation dialog
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Logout'),
            content: const Text('Are you sure you want to logout?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Logout'),
              ),
            ],
          ),
        );

        if (confirmed == true) {
          await dataCenter.logout();
          if (context.mounted) {
            // Navigate to login screen or show message
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Logged out successfully')),
            );
          }
        }
      },
      child: const Text('Logout'),
    );
  }
}

/// Example 4: Debug mode indicator
class DebugModeIndicator extends StatelessWidget {
  const DebugModeIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    final dataCenter = context.watch<AppDataCenterAppCodemart>();

    if (!dataCenter.isDebugMode) {
      return const SizedBox.shrink(); // Hide in production
    }

    return Container(
      color: Colors.orange,
      padding: const EdgeInsets.all(8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.bug_report, color: Colors.white),
          const SizedBox(width: 8),
          Text(
            'DEBUG MODE - Current Mode: ${dataCenter.currentUserMode.name}',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

/// Example 5: Using Consumer for selective rebuilding
class UserAvatarWidget extends StatelessWidget {
  const UserAvatarWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppDataCenterAppCodemart>(
      builder: (context, dataCenter, child) {
        if (!dataCenter.isLoggedIn) {
          return const CircleAvatar(
            child: Icon(Icons.person),
          );
        }

        final user = dataCenter.userProfile!;

        if (user.avatar != null) {
          return CircleAvatar(
            backgroundImage: NetworkImage(user.avatar!),
          );
        }

        return CircleAvatar(
          child: Text(user.name[0].toUpperCase()),
        );
      },
    );
  }
}

/// Example 6: Debug info dialog
class DebugInfoDialog extends StatelessWidget {
  const DebugInfoDialog({super.key});

  static void show(BuildContext context) {
    final dataCenter = context.read<AppDataCenterAppCodemart>();

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
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.info),
      onPressed: () => show(context),
      tooltip: 'Show Debug Info',
    );
  }
}

/// Example 7: Complete page with all features
class AppDataCenterExamplePage extends StatelessWidget {
  const AppDataCenterExamplePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AppDataCenter Examples'),
        actions: [
          Consumer<AppDataCenterAppCodemart>(
            builder: (context, dataCenter, child) {
              if (dataCenter.isDebugMode) {
                return IconButton(
                  icon: const Icon(Icons.bug_report),
                  onPressed: () => DebugInfoDialog.show(context),
                );
              }
              return const SizedBox.shrink();
            },
          ),
          const UserAvatarWidget(),
          const SizedBox(width: 16),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const DebugModeIndicator(),
            const SizedBox(height: 16),
            const UserProfileWidget(),
            const SizedBox(height: 16),
            const RoleBasedWidget(),
            const SizedBox(height: 16),
            const LogoutButton(),
          ],
        ),
      ),
    );
  }
}

/// Example 8: Using AppDataCenter in business logic
class ProjectService {
  final AppDataCenterAppCodemart _dataCenter = AppDataCenterAppCodemart();

  Future<bool> createProject(Map<String, dynamic> projectData) async {
    // Check if user is logged in
    if (!_dataCenter.isLoggedIn) {
      throw Exception('User must be logged in to create project');
    }

    // Check if user is a client
    if (!_dataCenter.isClient) {
      throw Exception('Only clients can create projects');
    }

    // Get user token for API request
    final token = _dataCenter.token;

    // Make API request with token
    // ...

    return true;
  }

  Future<bool> applyForTask(int taskId) async {
    // Check if user is logged in
    if (!_dataCenter.isLoggedIn) {
      throw Exception('User must be logged in to apply for task');
    }

    // Check if user is a developer
    if (!_dataCenter.isDeveloper) {
      throw Exception('Only developers can apply for tasks');
    }

    // Get developer profile
    final devProfile = _dataCenter.developerProfile;
    if (devProfile == null) {
      throw Exception('Developer profile not found');
    }

    // Check if developer has enough points or level
    if (devProfile.points < 100) {
      throw Exception('Insufficient points to apply for this task');
    }

    // Make API request
    // ...

    return true;
  }
}
