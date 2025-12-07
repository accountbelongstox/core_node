import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../widgets/app_drawer.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final events = [
      {
        'title': 'SOS drill success',
        'time': DateTime.now().subtract(const Duration(minutes: 5)),
        'details': 'Sarah confirmed daily safety check-in.',
      },
      {
        'title': 'Device online',
        'time': DateTime.now().subtract(const Duration(hours: 1)),
        'details': 'Mom connected to Wi-Fi at home.',
      },
      {
        'title': 'Route completed',
        'time': DateTime.now().subtract(const Duration(hours: 5)),
        'details': 'Alex finished evening commute.',
      },
    ];

    return Scaffold(
      appBar: AppBar(title: Text(appState.t('history.title'))),
      drawer: const AppDrawer(),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemCount: events.length,
        itemBuilder: (context, index) {
          final event = events[index];
          final time = event['time'] as DateTime;
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                child: Text('${index + 1}'),
              ),
              title: Text(event['title'] as String),
              subtitle: Text(event['details'] as String),
              trailing: Text('${time.hour}:${time.minute.toString().padLeft(2, '0')}'),
            ),
          );
        },
      ),
    );
  }
}
