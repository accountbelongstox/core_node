/// Main settings screen
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/services/settings_service.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../provider_app_qy/user_provider_app_qy.dart';
import '../widgets/settings_section.dart';
import '../widgets/settings_tile.dart';
import 'account_settings_screen.dart';
import 'display_settings_screen.dart';
import 'reminder_settings_screen.dart';
import 'recommend_settings_screen.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _currentTimezone = 'Asia/Beijing';
  bool _webviewCompat = false;
  bool _playerCompat = false;
  double _cacheSize = 128.5; // MB

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryGreen.withOpacity(0.1),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildAccountSection(),
                    const SizedBox(height: 24),
                    _buildStudySettingsSection(),
                    const SizedBox(height: 24),
                    _buildAppearanceSection(),
                    const SizedBox(height: 24),
                    _buildOtherSettingsSection(),
                    const SizedBox(height: 24),
                    _buildSupportSection(),
                    const SizedBox(height: 24),
                    _buildAppInfoSection(),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: AppTheme.textPrimary),
            onPressed: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: Text(
              'settings.title'.tr(context),
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountSection() {
    return Consumer<UserProviderAppQy>(
      builder: (context, userProvider, child) {
        final user = userProvider.currentUser;
        return SettingsSection(
          title: 'settings.account'.tr(context),
          child: Column(
            children: [
              SettingsTile(
                leading: CircleAvatar(
                  backgroundColor: AppTheme.primaryGreen,
                  child: Text(
                    user?.displayName?.substring(0, 1) ?? 'U',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                title: user?.displayName ?? QyAppLocalizationKeys.qyUser.tr(context),
                subtitle: user?.phone ?? QyAppLocalizationKeys.qyNotLoggedIn.tr(context),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _navigateToAccountSettings(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStudySettingsSection() {
    return SettingsSection(
      title: 'settings.study'.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.notifications_outlined,
              color: AppTheme.primaryGreen,
            ),
            title: 'settings.reminder'.tr(context),
            subtitle: QyAppLocalizationKeys.qyDailyStudyReminder.tr(context),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _navigateToReminderSettings(),
          ),
          SettingsTile(
            leading: Icon(
              Icons.trending_up_outlined,
              color: AppTheme.secondaryGreen,
            ),
            title: 'settings.recommend'.tr(context),
            subtitle: QyAppLocalizationKeys.qyPersonalizedRecommendations.tr(context),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _navigateToRecommendSettings(),
          ),
          SettingsTile(
            leading: Icon(
              Icons.sync_outlined,
              color: AppTheme.accentGreen,
            ),
            title: 'settings.dataSync'.tr(context),
            subtitle: QyAppLocalizationKeys.qySyncSettings.tr(context),
            trailing: Switch(
              value: true,
              onChanged: (value) {},
              activeColor: AppTheme.primaryGreen,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppearanceSection() {
    return Consumer<SettingsService>(
      builder: (context, settings, child) {
        return SettingsSection(
          title: 'settings.appearance'.tr(context),
          child: Column(
            children: [
              SettingsTile(
                leading: Icon(
                  settings.themeMode == ThemeMode.dark
                      ? Icons.dark_mode_outlined
                      : Icons.light_mode_outlined,
                  color: AppTheme.primaryGreen,
                ),
                title: 'settings.darkMode'.tr(context),
                subtitle: settings.themeMode == ThemeMode.dark
                    ? QyAppLocalizationKeys.qyDarkMode.tr(context)
                    : QyAppLocalizationKeys.qyLightMode.tr(context),
                trailing: Switch(
                  value: settings.themeMode == ThemeMode.dark,
                  onChanged: (value) {
                    settings.toggleDarkMode();
                  },
                  activeColor: AppTheme.primaryGreen,
                ),
              ),
              SettingsTile(
                leading: Icon(
                  Icons.translate_outlined,
                  color: AppTheme.secondaryGreen,
                ),
                title: 'settings.language'.tr(context),
                subtitle: settings.language == 'zh'
                    ? QyAppLocalizationKeys.qyLanguageChinese.tr(context)
                    : QyAppLocalizationKeys.qyLanguageEnglish.tr(context),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showLanguageDialog(),
              ),
              SettingsTile(
                leading: Icon(
                  Icons.desktop_windows_outlined,
                  color: AppTheme.accentGreen,
                ),
                title: 'settings.displayMode'.tr(context),
                subtitle: QyAppLocalizationKeys.qyDisplayLayoutSettings.tr(context),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _navigateToDisplaySettings(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildOtherSettingsSection() {
    return SettingsSection(
      title: 'settings.otherSettings'.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.storage_outlined,
              color: Colors.orange,
            ),
            title: 'settings.clearCache'.tr(context),
            subtitle: '${_cacheSize.toStringAsFixed(1)} MB',
            trailing: TextButton(
              onPressed: _clearCache,
              child: Text(
                QyAppLocalizationKeys.qyClear.tr(context),
                style: TextStyle(color: AppTheme.primaryGreen),
              ),
            ),
          ),
          SettingsTile(
            leading: Icon(
              Icons.web_outlined,
              color: AppTheme.primaryGreen,
            ),
            title: 'settings.webviewCompat'.tr(context),
            subtitle: QyAppLocalizationKeys.qyCompatibilitySettings.tr(context),
            trailing: Switch(
              value: _webviewCompat,
              onChanged: (value) {
                setState(() {
                  _webviewCompat = value;
                });
              },
              activeColor: AppTheme.primaryGreen,
            ),
          ),
          SettingsTile(
            leading: Icon(
              Icons.play_circle_outline,
              color: AppTheme.secondaryGreen,
            ),
            title: 'settings.playerCompat'.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsPlayerCompatibility.tr(context),
            trailing: Switch(
              value: _playerCompat,
              onChanged: (value) {
                setState(() {
                  _playerCompat = value;
                });
              },
              activeColor: AppTheme.primaryGreen,
            ),
          ),
          SettingsTile(
            leading: Icon(
              Icons.schedule_outlined,
              color: AppTheme.accentGreen,
            ),
            title: 'settings.timezone'.tr(context),
            subtitle: _currentTimezone,
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showTimezoneDialog(),
          ),
        ],
      ),
    );
  }

  Widget _buildSupportSection() {
    return SettingsSection(
      title: QyAppLocalizationKeys.qySupport.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.help_outline,
              color: AppTheme.primaryGreen,
            ),
            title: 'settings.help'.tr(context),
            subtitle: QyAppLocalizationKeys.qyHelp.tr(context),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _navigateToHelp(),
          ),
          SettingsTile(
            leading: Icon(
              Icons.feedback_outlined,
              color: AppTheme.secondaryGreen,
            ),
            title: 'settings.feedback'.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsFeedback.tr(context),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _navigateToFeedback(),
          ),
        ],
      ),
    );
  }

  Widget _buildAppInfoSection() {
    return SettingsSection(
      title: QyAppLocalizationKeys.qyAbout.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.info_outline,
              color: AppTheme.primaryGreen,
            ),
            title: 'settings.version'.tr(context),
            subtitle: 'v1.1.0',
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _navigateToAbout(),
          ),
          SettingsTile(
            leading: Icon(
              Icons.description_outlined,
              color: AppTheme.secondaryGreen,
            ),
            title: 'settings.agreement'.tr(context),
            subtitle: QyAppLocalizationKeys.qyTerms.tr(context),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _navigateToAgreement(),
          ),
          SettingsTile(
            leading: Icon(
              Icons.privacy_tip_outlined,
              color: AppTheme.accentGreen,
            ),
            title: 'settings.privacyPolicy'.tr(context),
            subtitle: QyAppLocalizationKeys.qyPrivacyPolicy.tr(context),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _navigateToPrivacyPolicy(),
          ),
        ],
      ),
    );
  }

  void _navigateToAccountSettings() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const AccountSettingsScreen(),
      ),
    );
  }

  void _navigateToDisplaySettings() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const DisplaySettingsScreen(),
      ),
    );
  }

  void _navigateToReminderSettings() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const ReminderSettingsScreen(),
      ),
    );
  }

  void _navigateToRecommendSettings() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const RecommendSettingsScreen(),
      ),
    );
  }

  void _showLanguageDialog() {
    final settingsService =
        Provider.of<SettingsService>(context, listen: false);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qyLanguage.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(QyAppLocalizationKeys.qyLanguageChinese.tr(context)),
              trailing: Consumer<SettingsService>(
                builder: (context, service, child) {
                  return service.language == 'zh'
                      ? Icon(Icons.check, color: AppTheme.primaryGreen)
                      : null;
                },
              ),
              onTap: () {
                settingsService.setLanguage('zh');
                Navigator.of(context).pop();
              },
            ),
            ListTile(
              title: Text(QyAppLocalizationKeys.qyLanguageEnglish.tr(context)),
              trailing: Consumer<SettingsService>(
                builder: (context, service, child) {
                  return service.language == 'en'
                      ? Icon(Icons.check, color: AppTheme.primaryGreen)
                      : null;
                },
              ),
              onTap: () {
                settingsService.setLanguage('en');
                Navigator.of(context).pop();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showTimezoneDialog() {
    final timezones = [
      'Asia/Beijing',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'America/New_York',
      'Europe/London',
    ];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('settings.timezone'.tr),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: timezones.length,
            itemBuilder: (context, index) {
              final timezone = timezones[index];
              final isSelected = timezone == _currentTimezone;
              return ListTile(
                title: Text(timezone),
                trailing: isSelected
                    ? Icon(Icons.check, color: AppTheme.primaryGreen)
                    : null,
                onTap: () {
                  setState(() {
                    _currentTimezone = timezone;
                  });
                  Navigator.of(context).pop();
                },
              );
            },
          ),
        ),
      ),
    );
  }

  void _clearCache() {
    final messageTemplate = QyAppLocalizationKeys.qyClearCacheMessage.tr(context);
    final message = messageTemplate.replaceFirst('{size}', _cacheSize.toStringAsFixed(1));
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qyClearCacheTitle.tr(context)),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyCancel.tr(context)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              setState(() {
                _cacheSize = 0.0;
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(QyAppLocalizationKeys.qyCacheCleared.tr(context)),
                  backgroundColor: AppTheme.primaryGreen,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryGreen,
              foregroundColor: Colors.white,
            ),
            child: Text(QyAppLocalizationKeys.qyConfirm.tr(context)),
          ),
        ],
      ),
    );
  }

  void _navigateToHelp() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyHelpCenterInProgress.tr(context)),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _navigateToFeedback() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qySettingsFeedbackInProgress.tr(context)),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _navigateToAbout() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qySettingsAboutInProgress.tr(context)),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _navigateToAgreement() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qySettingsTermsInProgress.tr(context)),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _navigateToPrivacyPolicy() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qySettingsPrivacyInProgress.tr(context)),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }
}
