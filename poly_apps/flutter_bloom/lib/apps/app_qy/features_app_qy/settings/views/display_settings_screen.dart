/// Display settings screen
library display_settings_screen;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/services/settings_service.dart';
import 'widgets/settings_section.dart';
import 'widgets/settings_tile.dart';

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
              'settings.displayMode'.tr,
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
      title: '字体设置',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.text_fields_outlined,
              color: AppTheme.primaryGreen,
            ),
            title: 'settings.fontSize'.tr,
            subtitle: '${_fontSize.toInt()}px',
            trailing: Container(
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
            title: '字体',
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
          title: '外观设置',
          child: Column(
            children: [
              SettingsTile(
                leading: Icon(
                  settings.themeMode == ThemeMode.dark
                      ? Icons.dark_mode_outlined
                      : Icons.light_mode_outlined,
                  color: AppTheme.primaryGreen,
                ),
                title: 'settings.darkMode'.tr,
                subtitle: settings.themeMode == ThemeMode.dark ? '深色模式' : '浅色模式',
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
                title: '界面布局',
                subtitle: '标准模式',
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
      title: '辅助功能',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.accessibility_outlined,
              color: AppTheme.accentGreen,
            ),
            title: '高对比度',
            subtitle: '提高文字和背景的对比度',
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
            title: '大字体模式',
            subtitle: '适合视力不佳的用户',
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
        title: Text('选择字体'),
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
        title: Text('界面布局'),
        content: Text('界面布局设置功能开发中...'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }
}