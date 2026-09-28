import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config_app_bank/constants.dart';

class DeveloperToolsScreen extends StatelessWidget {
  const DeveloperToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Developer Tools'),
        backgroundColor: const Color(0xFF74B9FF),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildToolCard(
            context,
            icon: Icons.api,
            title: 'API Status Monitor',
            subtitle: 'View API endpoint status and network logs',
            onTap: () {
              context.push(BankConstants.routeApiStatusMonitor);
            },
          ),
          const SizedBox(height: 12),
          _buildToolCard(
            context,
            icon: Icons.settings,
            title: 'Debug Settings',
            subtitle: 'Configure debug options',
            onTap: () {
              context.push(BankConstants.routeDebugSettings);
            },
          ),
          const SizedBox(height: 12),
          _buildToolCard(
            context,
            icon: Icons.feedback,
            title: 'Developer Feedback',
            subtitle: 'Submit feedback and bug reports',
            onTap: () {
              context.push(BankConstants.routeDeveloperFeedback);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildToolCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFF74B9FF).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                ),
                child: Icon(
                  icon,
                  color: const Color(0xFF74B9FF),
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}
