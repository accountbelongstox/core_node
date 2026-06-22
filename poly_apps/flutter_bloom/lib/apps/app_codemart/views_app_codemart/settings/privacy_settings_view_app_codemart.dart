import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class PrivacySettingsViewAppCodemart extends StatefulWidget {
  const PrivacySettingsViewAppCodemart({super.key});

  @override
  State<PrivacySettingsViewAppCodemart> createState() => _PrivacySettingsViewAppCodemartState();
}

class _PrivacySettingsViewAppCodemartState extends State<PrivacySettingsViewAppCodemart> {
  final bool _profileVisible = true;
  bool _showEmail = false;
  bool _showPhone = false;
  bool _allowMessages = true;
  bool _showOnlineStatus = true;
  bool _dataCollection = false;
  String _profileVisibility = 'public';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Privacy Settings'),
      ),
      body: ListView(
        children: [
          const ListTile(
            title: Text('Profile Visibility'),
            subtitle: Text('Control who can see your profile'),
          ),
          RadioListTile<String>(
            title: const Text('Public'),
            subtitle: const Text('Anyone can view your profile'),
            value: 'public',
            groupValue: _profileVisibility,
            onChanged: (value) => setState(() => _profileVisibility = value!),
          ),
          RadioListTile<String>(
            title: const Text('Connections Only'),
            subtitle: const Text('Only people you work with'),
            value: 'connections',
            groupValue: _profileVisibility,
            onChanged: (value) => setState(() => _profileVisibility = value!),
          ),
          RadioListTile<String>(
            title: const Text('Private'),
            subtitle: const Text('Only you can view your profile'),
            value: 'private',
            groupValue: _profileVisibility,
            onChanged: (value) => setState(() => _profileVisibility = value!),
          ),
          const Divider(),
          const ListTile(
            title: Text('Contact Information'),
            subtitle: Text('Choose what contact info to display'),
          ),
          SwitchListTile(
            title: const Text('Show Email'),
            subtitle: const Text('Display email on your profile'),
            value: _showEmail,
            onChanged: (value) => setState(() => _showEmail = value),
          ),
          SwitchListTile(
            title: const Text('Show Phone'),
            subtitle: const Text('Display phone number on your profile'),
            value: _showPhone,
            onChanged: (value) => setState(() => _showPhone = value),
          ),
          const Divider(),
          const ListTile(
            title: Text('Communication'),
            subtitle: Text('Control who can contact you'),
          ),
          SwitchListTile(
            title: const Text('Allow Messages'),
            subtitle: const Text('Let others send you messages'),
            value: _allowMessages,
            onChanged: (value) => setState(() => _allowMessages = value),
          ),
          SwitchListTile(
            title: const Text('Show Online Status'),
            subtitle: const Text('Let others see when you are online'),
            value: _showOnlineStatus,
            onChanged: (value) => setState(() => _showOnlineStatus = value),
          ),
          const Divider(),
          const ListTile(
            title: Text('Data & Analytics'),
            subtitle: Text('Help improve the app'),
          ),
          SwitchListTile(
            title: const Text('Data Collection'),
            subtitle: const Text('Allow anonymous usage data collection'),
            value: _dataCollection,
            onChanged: (value) => setState(() => _dataCollection = value),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.delete, color: Colors.red),
            title: const Text('Delete Account', style: TextStyle(color: Colors.red)),
            subtitle: const Text('Permanently delete your account and data'),
            onTap: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Delete Account'),
                  content: const Text(
                    'Are you sure you want to delete your account? '
                    'This action cannot be undone and all your data will be permanently deleted.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel'),
                    ),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.red,
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                        // TODO: Implement account deletion
                      },
                      child: const Text('Delete'),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Privacy settings saved')),
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
