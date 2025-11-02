import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class VipClubSettingsScreen extends StatefulWidget {
  const VipClubSettingsScreen({super.key});

  @override
  State<VipClubSettingsScreen> createState() => _VipClubSettingsScreenState();
}

class _VipClubSettingsScreenState extends State<VipClubSettingsScreen> {
  bool _notificationsEnabled = true;
  bool _emailNotifications = true;
  bool _pushNotifications = true;
  bool _smsNotifications = false;
  String _selectedLanguage = 'English';
  bool _darkMode = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Settings',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: ListView(
        children: [
          _buildSection(
            title: 'Notifications',
            children: [
              _buildSwitchTile(
                title: 'Enable Notifications',
                subtitle: 'Receive booking updates and reminders',
                value: _notificationsEnabled,
                onChanged: (value) {
                  setState(() {
                    _notificationsEnabled = value;
                  });
                },
              ),
              if (_notificationsEnabled) ...[
                _buildSwitchTile(
                  title: 'Email Notifications',
                  value: _emailNotifications,
                  onChanged: (value) {
                    setState(() {
                      _emailNotifications = value;
                    });
                  },
                ),
                _buildSwitchTile(
                  title: 'Push Notifications',
                  value: _pushNotifications,
                  onChanged: (value) {
                    setState(() {
                      _pushNotifications = value;
                    });
                  },
                ),
                _buildSwitchTile(
                  title: 'SMS Notifications',
                  value: _smsNotifications,
                  onChanged: (value) {
                    setState(() {
                      _smsNotifications = value;
                    });
                  },
                ),
              ],
            ],
          ),
          _buildSection(
            title: 'Preferences',
            children: [
              _buildListTile(
                icon: Icons.language,
                title: 'Language',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _selectedLanguage,
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: ThemeColors.neutralGrey,
                      ),
                    ),
                    SizedBox(width: ThemeDimensions.smallPadding),
                    Icon(
                      Icons.chevron_right,
                      color: ThemeColors.neutralGrey,
                    ),
                  ],
                ),
                onTap: () {
                  _showLanguageDialog();
                },
              ),
              _buildSwitchTile(
                title: 'Dark Mode',
                subtitle: 'Enable dark theme',
                value: _darkMode,
                onChanged: (value) {
                  setState(() {
                    _darkMode = value;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Dark mode coming soon'),
                    ),
                  );
                },
              ),
            ],
          ),
          _buildSection(
            title: 'Account',
            children: [
              _buildListTile(
                icon: Icons.lock,
                title: 'Change Password',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Change password feature coming soon'),
                    ),
                  );
                },
              ),
              _buildListTile(
                icon: Icons.security,
                title: 'Privacy Settings',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Privacy settings coming soon'),
                    ),
                  );
                },
              ),
              _buildListTile(
                icon: Icons.payment,
                title: 'Payment Methods',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Payment methods coming soon'),
                    ),
                  );
                },
              ),
            ],
          ),
          _buildSection(
            title: 'About',
            children: [
              _buildListTile(
                icon: Icons.info,
                title: 'App Version',
                trailing: Text(
                  '1.0.0',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ThemeColors.neutralGrey,
                  ),
                ),
              ),
              _buildListTile(
                icon: Icons.description,
                title: 'Terms of Service',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Terms of service coming soon'),
                    ),
                  );
                },
              ),
              _buildListTile(
                icon: Icons.privacy_tip,
                title: 'Privacy Policy',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Privacy policy coming soon'),
                    ),
                  );
                },
              ),
              _buildListTile(
                icon: Icons.help,
                title: 'Help & Support',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Help & support coming soon'),
                    ),
                  );
                },
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.hugePadding),
        ],
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(
            ThemeDimensions.defaultPadding,
            ThemeDimensions.largePadding,
            ThemeDimensions.defaultPadding,
            ThemeDimensions.smallPadding,
          ),
          child: Text(
            title,
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        ...children,
      ],
    );
  }

  Widget _buildListTile({
    required IconData icon,
    required String title,
    String? subtitle,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return Card(
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      child: ListTile(
        leading: Icon(
          icon,
          color: ThemeColors.primaryBlue,
        ),
        title: Text(
          title,
          style: ThemeTextStyles.bodyLarge,
        ),
        subtitle: subtitle != null
            ? Text(
                subtitle,
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
              )
            : null,
        trailing: trailing ??
            (onTap != null
                ? Icon(
                    Icons.chevron_right,
                    color: ThemeColors.neutralGrey,
                  )
                : null),
        onTap: onTap,
      ),
    );
  }

  Widget _buildSwitchTile({
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Card(
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      child: SwitchListTile(
        title: Text(
          title,
          style: ThemeTextStyles.bodyLarge,
        ),
        subtitle: subtitle != null
            ? Text(
                subtitle,
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
              )
            : null,
        value: value,
        onChanged: onChanged,
        activeColor: ThemeColors.primaryBlue,
      ),
    );
  }

  void _showLanguageDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Select Language'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildLanguageOption('English'),
              _buildLanguageOption('中文'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildLanguageOption(String language) {
    final isSelected = _selectedLanguage == language;
    return RadioListTile<String>(
      title: Text(language),
      value: language,
      groupValue: _selectedLanguage,
      activeColor: ThemeColors.primaryBlue,
      onChanged: (value) {
        if (value != null) {
          setState(() {
            _selectedLanguage = value;
          });
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Language changed to $value'),
            ),
          );
        }
      },
    );
  }
}
