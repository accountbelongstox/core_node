import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class NotificationSettingsViewAppCodemart extends StatefulWidget {
  const NotificationSettingsViewAppCodemart({super.key});

  @override
  State<NotificationSettingsViewAppCodemart> createState() => _NotificationSettingsViewAppCodemartState();
}

class _NotificationSettingsViewAppCodemartState extends State<NotificationSettingsViewAppCodemart> {
  bool _enableAll = true;
  bool _taskNotifications = true;
  bool _projectNotifications = true;
  bool _paymentNotifications = true;
  bool _messageNotifications = true;
  bool _emailNotifications = false;
  bool _pushNotifications = true;
  bool _soundEnabled = true;
  bool _vibrationEnabled = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Settings'),
      ),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('Enable All Notifications'),
            subtitle: const Text('Master switch for all notifications'),
            value: _enableAll,
            onChanged: (value) {
              setState(() {
                _enableAll = value;
                if (!value) {
                  _taskNotifications = false;
                  _projectNotifications = false;
                  _paymentNotifications = false;
                  _messageNotifications = false;
                }
              });
            },
          ),
          const Divider(),
          const ListTile(
            title: Text('Notification Types'),
            subtitle: Text('Choose what you want to be notified about'),
          ),
          SwitchListTile(
            title: const Text('Task Updates'),
            subtitle: const Text('Task assigned, completed, or rejected'),
            value: _taskNotifications,
            onChanged: _enableAll ? (value) => setState(() => _taskNotifications = value) : null,
          ),
          SwitchListTile(
            title: const Text('Project Updates'),
            subtitle: const Text('Proposals, milestones, and project status'),
            value: _projectNotifications,
            onChanged: _enableAll ? (value) => setState(() => _projectNotifications = value) : null,
          ),
          SwitchListTile(
            title: const Text('Payment Notifications'),
            subtitle: const Text('Payments received, sent, or pending'),
            value: _paymentNotifications,
            onChanged: _enableAll ? (value) => setState(() => _paymentNotifications = value) : null,
          ),
          SwitchListTile(
            title: const Text('Messages'),
            subtitle: const Text('New messages from clients or developers'),
            value: _messageNotifications,
            onChanged: _enableAll ? (value) => setState(() => _messageNotifications = value) : null,
          ),
          const Divider(),
          const ListTile(
            title: Text('Delivery Methods'),
            subtitle: Text('How you receive notifications'),
          ),
          SwitchListTile(
            title: const Text('Push Notifications'),
            subtitle: const Text('Receive notifications on this device'),
            value: _pushNotifications,
            onChanged: (value) => setState(() => _pushNotifications = value),
          ),
          SwitchListTile(
            title: const Text('Email Notifications'),
            subtitle: const Text('Receive notifications via email'),
            value: _emailNotifications,
            onChanged: (value) => setState(() => _emailNotifications = value),
          ),
          const Divider(),
          const ListTile(
            title: Text('Notification Behavior'),
            subtitle: Text('Sound and vibration settings'),
          ),
          SwitchListTile(
            title: const Text('Sound'),
            subtitle: const Text('Play sound for notifications'),
            value: _soundEnabled,
            onChanged: (value) => setState(() => _soundEnabled = value),
          ),
          SwitchListTile(
            title: const Text('Vibration'),
            subtitle: const Text('Vibrate for notifications'),
            value: _vibrationEnabled,
            onChanged: (value) => setState(() => _vibrationEnabled = value),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Settings saved')),
                );
                Navigator.pop(context);
              },
              child: const Text('Save Changes'),
            ),
          ),
        ],
      ),
    );
  }
}
