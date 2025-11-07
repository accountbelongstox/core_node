/// Display settings screen
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/services/settings_service.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../widgets/settings_section.dart';
import '../widgets/settings_tile.dart';

class DisplaySettingsScreen extends StatefulWidget {
  const DisplaySettingsScreen({super.key});

  @override
  State<DisplaySettingsScreen> createState() => _DisplaySettingsScreenState();
}

class _DisplaySettingsScreenState extends State<DisplaySettingsScreen> {
  double _fontSize = 16.0;
  String _fontFamily = 'System';
  bool _highContrast = false;
  bool _largeText = false;

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
                    _buildFontSettings(),
                    const SizedBox(height: 24),
                    _buildAppearanceSettings(),
                    const SizedBox(height: 24),
                    _buildAccessibilitySettings(),
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
              'settings.displayMode'.tr(context),
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

  Widget _buildFontSettings() {
    return SettingsSection(
      title: QyAppLocalizationKeys.qySettingsFontSettings.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.text_fields_outlined,
              color: AppTheme.primaryGreen,
            ),
            title: 'settings.fontSize'.tr(context),
            subtitle: '${_fontSize.toInt()}px',
            trailing: SizedBox(
              width: 200,
              child: Slider(
                value: _fontSize,
                min: 12.0,
                max: 24.0,
                divisions: 6,
                onChanged: (value) {
                  setState(() {
                    _fontSize = value;
                  });
                },
                activeColor: AppTheme.primaryGreen,
              ),
            ),
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.font_download_outlined,
              color: AppTheme.secondaryGreen,
            ),
            title: QyAppLocalizationKeys.qySettingsFont.tr(context),
            subtitle: _fontFamily,
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showFontFamilyDialog(),
          ),
        ],
      ),
    );
  }

  Widget _buildAppearanceSettings() {
    return Consumer<SettingsService>(
      builder: (context, settings, child) {
        return SettingsSection(
          title: QyAppLocalizationKeys.qySettingsAppearanceSettings.tr(context),
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
                subtitle: settings.themeMode == ThemeMode.dark ? QyAppLocalizationKeys.qyDarkMode.tr(context) : QyAppLocalizationKeys.qyLightMode.tr(context),
                trailing: Switch(
                  value: settings.themeMode == ThemeMode.dark,
                  onChanged: (value) {
                    settings.toggleDarkMode();
                  },
                  activeColor: AppTheme.primaryGreen,
                ),
              ),
              const Divider(height: 1, indent: 72),
              SettingsTile(
                leading: Icon(
                  Icons.grid_view_outlined,
                  color: AppTheme.secondaryGreen,
                ),
                title: QyAppLocalizationKeys.qySettingsInterfaceLayout.tr(context),
                subtitle: QyAppLocalizationKeys.qySettingsStandardMode.tr(context),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showLayoutDialog(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAccessibilitySettings() {
    return SettingsSection(
      title: QyAppLocalizationKeys.qySettingsAccessibility.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.accessibility_outlined,
              color: AppTheme.accentGreen,
            ),
            title: QyAppLocalizationKeys.qySettingsHighContrast.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsHighContrastSubtitle.tr(context),
            trailing: Switch(
              value: _highContrast,
              onChanged: (value) {
                setState(() {
                  _highContrast = value;
                });
              },
              activeColor: AppTheme.primaryGreen,
            ),
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.format_size_outlined,
              color: Colors.orange,
            ),
            title: QyAppLocalizationKeys.qySettingsLargeFontMode.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsLargeFontModeSubtitle.tr(context),
            trailing: Switch(
              value: _largeText,
              onChanged: (value) {
                setState(() {
                  _largeText = value;
                  if (value) {
                    _fontSize = 20.0;
                  } else {
                    _fontSize = 16.0;
                  }
                });
              },
              activeColor: AppTheme.primaryGreen,
            ),
          ),
        ],
      ),
    );
  }

  void _showFontFamilyDialog() {
    final fonts = ['System', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsSelectFont.tr(context)),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: fonts.length,
            itemBuilder: (context, index) {
              final font = fonts[index];
              final isSelected = font == _fontFamily;
              return ListTile(
                title: Text(font),
                trailing: isSelected
                    ? Icon(Icons.check, color: AppTheme.primaryGreen)
                    : null,
                onTap: () {
                  setState(() {
                    _fontFamily = font;
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

  void _showLayoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsInterfaceLayout.tr(context)),
        content: Text(QyAppLocalizationKeys.qySettingsLayoutInProgress.tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
          ),
        ],
      ),
    );
  }
}