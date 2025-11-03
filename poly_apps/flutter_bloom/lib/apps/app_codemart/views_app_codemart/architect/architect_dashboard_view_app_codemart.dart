import 'package:flutter/material.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../router_app_codemart/router_app_codemart.dart';

class ArchitectDashboardViewAppCodemart extends StatefulWidget {
  const ArchitectDashboardViewAppCodemart({super.key});

  @override
  State<ArchitectDashboardViewAppCodemart> createState() => _ArchitectDashboardViewAppCodemartState();
}

class _ArchitectDashboardViewAppCodemartState extends State<ArchitectDashboardViewAppCodemart> {
  // Mock data
  final int _pendingProposals = 3;
  final int _activeProjects = 5;
  final int _completedProjects = 12;
  final double _successRate = 94.5;

  final List<Map<String, dynamic>> _recentProjects = [
    {
      'id': 1,
      'title': 'E-commerce Platform',
      'status': 'active',
      'progress': 0.65,
      'deadline': DateTime.now().add(const Duration(days: 15)),
    },
    {
      'id': 2,
      'title': 'Mobile Banking App',
      'status': 'active',
      'progress': 0.40,
      'deadline': DateTime.now().add(const Duration(days: 30)),
    },
    {
      'id': 3,
      'title': 'Healthcare System',
      'status': 'proposal',
      'progress': 0.0,
      'deadline': DateTime.now().add(const Duration(days: 5)),
    },
  ];

  final List<Map<String, dynamic>> _pendingReviews = [
    {'id': 1, 'developer': 'John Doe', 'task': 'Authentication Module', 'date': DateTime.now()},
    {'id': 2, 'developer': 'Jane Smith', 'task': 'Payment Integration', 'date': DateTime.now()},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr(LocalizationKeysAppCodemart.codemartArchitect)),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications),
            onPressed: () => RouterAppCodemart.goToNotifications(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          // TODO: Refresh data
          await Future.delayed(const Duration(seconds: 1));
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Statistics cards
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    title: 'Pending',
                    value: _pendingProposals.toString(),
                    icon: Icons.pending_actions,
                    color: Colors.orange,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    title: 'Active',
                    value: _activeProjects.toString(),
                    icon: Icons.work,
                    color: Colors.blue,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    title: 'Completed',
                    value: _completedProjects.toString(),
                    icon: Icons.check_circle,
                    color: Colors.green,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    title: 'Success Rate',
                    value: '${_successRate.toStringAsFixed(1)}%',
                    icon: Icons.trending_up,
                    color: Colors.purple,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Quick actions
            Text(
              'Quick Actions',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _ActionButton(
                    icon: Icons.add_circle,
                    label: 'Create Proposal',
                    onTap: () {
                      // TODO: Navigate to create proposal
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.assessment,
                    label: 'View Analytics',
                    onTap: () {
                      // TODO: Navigate to analytics
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Recent projects
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recent Projects',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                TextButton(
                  onPressed: () => RouterAppCodemart.goToProjects(context),
                  child: const Text('View All'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...List.generate(_recentProjects.length, (index) {
              final project = _recentProjects[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _getStatusColor(project['status']).withOpacity(0.2),
                    child: Icon(
                      _getStatusIcon(project['status']),
                      color: _getStatusColor(project['status']),
                    ),
                  ),
                  title: Text(project['title']),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 4),
                      LinearProgressIndicator(
                        value: project['progress'],
                        backgroundColor: Colors.grey.shade200,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Due: ${project['deadline'].toString().split(' ')[0]}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                  trailing: Chip(
                    label: Text(project['status']),
                    backgroundColor: _getStatusColor(project['status']).withOpacity(0.2),
                  ),
                  onTap: () => RouterAppCodemart.goToProjectDetails(context, project['id']),
                ),
              );
            }),
            const SizedBox(height: 24),

            // Pending reviews
            if (_pendingReviews.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Pending Reviews',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Badge(
                    label: Text(_pendingReviews.length.toString()),
                    backgroundColor: Colors.red,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ...List.generate(_pendingReviews.length, (index) {
                final review = _pendingReviews[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const CircleAvatar(
                      child: Icon(Icons.person),
                    ),
                    title: Text(review['developer']),
                    subtitle: Text(review['task']),
                    trailing: FilledButton(
                      onPressed: () {
                        // TODO: Navigate to review task
                      },
                      child: const Text('Review'),
                    ),
                  ),
                );
              }),
            ],
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // TODO: Navigate to create proposal
        },
        icon: const Icon(Icons.add),
        label: const Text('New Proposal'),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return Colors.blue;
      case 'proposal':
        return Colors.orange;
      case 'completed':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return Icons.work;
      case 'proposal':
        return Icons.description;
      case 'completed':
        return Icons.check_circle;
      default:
        return Icons.folder;
    }
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, size: 32, color: color),
            const SizedBox(height: 8),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
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
            children: [
              Icon(icon, size: 32),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
