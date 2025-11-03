import 'package:flutter/material.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';

class NotificationsViewAppCodemart extends StatefulWidget {
  const NotificationsViewAppCodemart({super.key});

  @override
  State<NotificationsViewAppCodemart> createState() => _NotificationsViewAppCodemartState();
}

class _NotificationsViewAppCodemartState extends State<NotificationsViewAppCodemart> {
  // Mock data
  final List<Map<String, dynamic>> _notifications = [
    {
      'id': 1,
      'type': 'task_accepted',
      'title': 'Task Accepted',
      'message': 'Your task submission has been accepted',
      'date': DateTime.now().subtract(const Duration(hours: 2)),
      'isRead': false,
      'icon': Icons.check_circle,
      'color': Colors.green,
    },
    {
      'id': 2,
      'type': 'payment_received',
      'title': 'Payment Received',
      'message': 'You received \$500 for task completion',
      'date': DateTime.now().subtract(const Duration(hours: 5)),
      'isRead': false,
      'icon': Icons.attach_money,
      'color': Colors.blue,
    },
    {
      'id': 3,
      'type': 'task_assigned',
      'title': 'New Task Assigned',
      'message': 'You have been assigned a new task',
      'date': DateTime.now().subtract(const Duration(days: 1)),
      'isRead': true,
      'icon': Icons.assignment,
      'color': Colors.orange,
    },
    {
      'id': 4,
      'type': 'proposal_submitted',
      'title': 'Proposal Submitted',
      'message': 'Architect has submitted a proposal for your project',
      'date': DateTime.now().subtract(const Duration(days: 2)),
      'isRead': true,
      'icon': Icons.description,
      'color': Colors.purple,
    },
  ];

  void _markAsRead(int id) {
    setState(() {
      final notification = _notifications.firstWhere((n) => n['id'] == id);
      notification['isRead'] = true;
    });
  }

  void _markAllAsRead() {
    setState(() {
      for (var notification in _notifications) {
        notification['isRead'] = true;
      }
    });
  }

  void _deleteNotification(int id) {
    setState(() {
      _notifications.removeWhere((n) => n['id'] == id);
    });
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      if (difference.inHours == 0) {
        return '${difference.inMinutes} minutes ago';
      }
      return '${difference.inHours} hours ago';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else {
      return '${date.day}/${date.month}/${date.year}';
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => !n['isRead']).length;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Text('Notifications'),
            if (unreadCount > 0) ...[
              const SizedBox(width: 8),
              CircleAvatar(
                radius: 12,
                backgroundColor: Colors.red,
                child: Text(
                  '$unreadCount',
                  style: const TextStyle(fontSize: 12, color: Colors.white),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (unreadCount > 0)
            IconButton(
              icon: const Icon(Icons.done_all),
              onPressed: _markAllAsRead,
              tooltip: 'Mark all as read',
            ),
        ],
      ),
      body: _notifications.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_off,
                    size: 64,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    context.tr(LocalizationKeysAppCodemart.codemartNoData),
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: _notifications.length,
              itemBuilder: (context, index) {
                final notification = _notifications[index];
                final isRead = notification['isRead'] as bool;

                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                  color: isRead ? null : Theme.of(context).colorScheme.surfaceVariant,
                  child: Dismissible(
                    key: Key(notification['id'].toString()),
                    direction: DismissDirection.endToStart,
                    onDismissed: (direction) {
                      _deleteNotification(notification['id'] as int);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Notification deleted')),
                      );
                    },
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 20),
                      color: Colors.red,
                      child: const Icon(Icons.delete, color: Colors.white),
                    ),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: (notification['color'] as Color).withOpacity(0.2),
                        child: Icon(
                          notification['icon'] as IconData,
                          color: notification['color'] as Color,
                        ),
                      ),
                      title: Text(
                        notification['title'] as String,
                        style: TextStyle(
                          fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
                        ),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(notification['message'] as String),
                          const SizedBox(height: 4),
                          Text(
                            _formatDate(notification['date'] as DateTime),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                      onTap: () {
                        if (!isRead) {
                          _markAsRead(notification['id'] as int);
                        }
                        // TODO: Navigate to related content
                      },
                    ),
                  ),
                );
              },
            ),
    );
  }
}
