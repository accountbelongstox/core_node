import 'package:flutter/material.dart';

import '../models.dart';

class FriendCard extends StatelessWidget {
  const FriendCard({
    required this.friend,
    required this.onTap,
    required this.onToggleMonitor,
    super.key,
  });

  final Friend friend;
  final VoidCallback onTap;
  final VoidCallback onToggleMonitor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundImage: NetworkImage(friend.avatar),
                radius: 28,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(friend.name,
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    Text('${friend.relation} • ${friend.lastActive}',
                        style: theme.textTheme.bodySmall),
                    const SizedBox(height: 4),
                    Text('Connected ${friend.daysConnected} days',
                        style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
              Switch(
                value: friend.isMonitored,
                onChanged: (_) => onToggleMonitor(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
