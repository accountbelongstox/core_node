import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models.dart';

class FriendDetailScreen extends StatelessWidget {
  const FriendDetailScreen({super.key, required this.friendId});

  final String friendId;

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final Friend? friend = appState.getFriendById(friendId);

    if (friend == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Friend')),
        body: const Center(child: Text('Friend not found')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(friend.name)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundImage: NetworkImage(friend.avatar),
                radius: 32,
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(friend.name,
                      style: Theme.of(context).textTheme.titleLarge),
                  Text('${friend.relation} • ${friend.phone}'),
                  Text('Connected ${friend.daysConnected} days'),
                ],
              )
            ],
          ),
          const SizedBox(height: 24),
          Text('Health', style: Theme.of(context).textTheme.titleMedium),
          Card(
            child: ListTile(
              title: Text('Steps: ${friend.health.steps}'),
              subtitle: Text(
                  'Heart rate: ${friend.health.heartRate} bpm • Temp: ${friend.health.temperature.toStringAsFixed(1)} ℃'),
            ),
          ),
          const SizedBox(height: 16),
          Text('Device', style: Theme.of(context).textTheme.titleMedium),
          Card(
            child: ListTile(
              title: Text(friend.device.network),
              subtitle: Text(
                  'Unlocks: ${friend.device.unlocks} • Usage: ${friend.device.usageTime}'),
            ),
          ),
          const SizedBox(height: 16),
          Text('Location', style: Theme.of(context).textTheme.titleMedium),
          Card(
            child: ListTile(
              leading: const Icon(Icons.place_outlined),
              title: Text(friend.location.address),
              subtitle:
                  Text('Lat ${friend.location.latitude}, Lng ${friend.location.longitude}'),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.pushNamed(context, '/friends/request'),
            child: const Text('Send Message'),
          ),
        ],
      ),
    );
  }
}
