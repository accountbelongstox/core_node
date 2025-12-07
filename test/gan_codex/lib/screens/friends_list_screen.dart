import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../widgets/app_drawer.dart';
import '../widgets/friend_card.dart';

class FriendsListScreen extends StatelessWidget {
  const FriendsListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Scaffold(
      appBar: AppBar(
        title: Text(appState.t('friends.title')),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => Navigator.pushNamed(context, '/friends/add'),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/friends/request'),
        icon: const Icon(Icons.mail_outline),
        label: Text(appState.t('friends.request')),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemCount: appState.friends.length,
        itemBuilder: (context, index) {
          final friend = appState.friends[index];
          return FriendCard(
            friend: friend,
            onTap: () => Navigator.pushNamed(
              context,
              '/friends/detail',
              arguments: friend.id,
            ),
            onToggleMonitor: () => appState.toggleMonitor(friend.id),
          );
        },
      ),
    );
  }
}
