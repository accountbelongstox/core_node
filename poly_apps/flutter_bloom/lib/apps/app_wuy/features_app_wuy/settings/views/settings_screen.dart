// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class WuySettingsScreen extends StatefulWidget {
  const WuySettingsScreen({super.key});

  @override
  State<WuySettingsScreen> createState() => _WuySettingsScreenState();
}

class _WuySettingsScreenState extends State<WuySettingsScreen> {
  bool _notificationsEnabled = true;
  bool _darkModeEnabled = false;
  bool _biometricEnabled = false;
  String _selectedLanguage = 'English';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Settings',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
      ),
      body: ListView(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        children: [
          _buildSettingsSection(
            'General',
            [
              _buildLanguageSelector(),
              _buildSwitchTile(
                'Dark Mode',
                'Enable dark theme',
                _darkModeEnabled,
                (value) => setState(() => _darkModeEnabled = value),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildSettingsSection(
            'Notifications',
            [
              _buildSwitchTile(
                'Push Notifications',
                'Receive push notifications',
                _notificationsEnabled,
                (value) => setState(() => _notificationsEnabled = value),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildSettingsSection(
            'Security',
            [
              _buildSwitchTile(
                'Biometric Login',
                'Use fingerprint or face ID',
                _biometricEnabled,
                (value) => setState(() => _biometricEnabled = value),
              ),
              _buildListTile(
                'Change Password',
                'Update your password',
                Icons.lock,
                () {},
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildSettingsSection(
            'About',
            [
              _buildListTile(
                'Version',
                '1.0.0',
                Icons.info,
                null,
              ),
              _buildListTile(
                'Terms of Service',
                'Read our terms',
                Icons.description,
                () {},
              ),
              _buildListTile(
                'Privacy Policy',
                'Read our privacy policy',
                Icons.privacy_tip,
                () {},
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: ThemeTextStyles.titleLarge.copyWith(
            color: ThemeColors.primary,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingSmall),
        Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          ),
          child: Column(
            children: children,
          ),
        ),
      ],
    );
  }

  Widget _buildSwitchTile(
    String title,
    String subtitle,
    bool value,
    Function(bool) onChanged,
  ) {
    return ListTile(
      title: Text(
        title,
        style: ThemeTextStyles.titleMedium,
      ),
      subtitle: Text(
        subtitle,
        style: ThemeTextStyles.bodyMedium.copyWith(
          color: ThemeColors.textSecondary,
        ),
      ),
      trailing: Switch(
        value: value,
        onChanged: onChanged,
        activeColor: ThemeColors.primary,
      ),
    );
  }

  Widget _buildListTile(
    String title,
    String subtitle,
    IconData icon,
    VoidCallback? onTap,
  ) {
    return ListTile(
      leading: Icon(
        icon,
        color: ThemeColors.primary,
      ),
      title: Text(
        title,
        style: ThemeTextStyles.titleMedium,
      ),
      subtitle: Text(
        subtitle,
        style: ThemeTextStyles.bodyMedium.copyWith(
          color: ThemeColors.textSecondary,
        ),
      ),
      trailing: onTap != null
          ? Icon(
              Icons.arrow_forward_ios,
              size: 16,
              color: ThemeColors.textSecondary,
            )
          : null,
      onTap: onTap,
    );
  }

  Widget _buildLanguageSelector() {
    return ListTile(
      title: Text(
        'Language',
        style: ThemeTextStyles.titleMedium,
      ),
      subtitle: Text(
        _selectedLanguage,
        style: ThemeTextStyles.bodyMedium.copyWith(
          color: ThemeColors.textSecondary,
        ),
      ),
      trailing: DropdownButton<String>(
        value: _selectedLanguage,
        underline: Container(),
        items: ['English', 'Chinese'].map((String value) {
          return DropdownMenuItem<String>(
            value: value,
            child: Text(value),
          );
        }).toList(),
        onChanged: (String? newValue) {
          if (newValue != null) {
            setState(() {
              _selectedLanguage = newValue;
            });
          }
        },
      ),
    );
  }
}