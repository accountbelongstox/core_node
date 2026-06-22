// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../controller/settings_controller.dart';
import '../settings/models/setting_item.dart';

/// Example Settings Page
/// Demonstrates how to use the enhanced settings system with persistent storage
class SettingsPageExample extends StatefulWidget {
  const SettingsPageExample({super.key});

  @override
  State<SettingsPageExample> createState() => _SettingsPageExampleState();
}

class _SettingsPageExampleState extends State<SettingsPageExample> {
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings Example'),
        actions: [
          IconButton(
            icon: const Icon(Icons.info),
            onPressed: _showDebugInfo,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _resetAllSettings,
          ),
        ],
      ),
      body: Consumer<SettingsController>(
        builder: (context, settingsController, child) {
          if (!settingsController.isInitialized) {
            return const Center(child: CircularProgressIndicator());
          }

          final settingsByCategory = settingsController.getSettingsByCategory();
          
          return _isLoading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  itemCount: settingsByCategory.keys.length,
                  itemBuilder: (context, index) {
                    final category = settingsByCategory.keys.elementAt(index);
                    final settings = settingsByCategory[category]!;
                    
                    return _buildCategorySection(
                      context,
                      category,
                      settings,
                      settingsController,
                    );
                  },
                );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _clearAllSettings,
        tooltip: 'Clear All Settings',
        child: const Icon(Icons.clear_all),
      ),
    );
  }

  Widget _buildCategorySection(
    BuildContext context,
    String category,
    List<SettingItem> settings,
    SettingsController controller,
  ) {
    return Card(
      margin: const EdgeInsets.all(8.0),
      child: ExpansionTile(
        title: Text(
          _formatCategoryName(category),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        children: settings.map((setting) {
          return _buildSettingTile(context, setting, controller);
        }).toList(),
      ),
    );
  }

  Widget _buildSettingTile(
    BuildContext context,
    SettingItem setting,
    SettingsController controller,
  ) {
    switch (setting.type) {
      case SettingType.toggle:
        return _buildToggleTile(setting, controller);
      
      case SettingType.select:
        return _buildSelectTile(setting, controller);
      
      case SettingType.checkbox:
        return _buildCheckboxTile(setting, controller);
      
      case SettingType.slider:
        return _buildSliderTile(setting, controller);
      
      case SettingType.textInput:
        return _buildTextInputTile(setting, controller);
      
      default:
        return ListTile(
          title: Text(setting.name),
          subtitle: Text(setting.description ?? ''),
          trailing: Text('Unsupported type: ${setting.type}'),
        );
    }
  }

  Widget _buildToggleTile(SettingItem setting, SettingsController controller) {
    final value = controller.getSetting<bool>(setting.key, false) ?? false;
    
    return SwitchListTile(
      title: Text(setting.name),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (setting.description != null) Text(setting.description!),
          if (setting.disableCache)
            Text(
              'Cache disabled',
              style: TextStyle(
                color: Colors.orange,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
            ),
        ],
      ),
      value: value,
      onChanged: (newValue) async {
        await controller.setSetting(setting.key, newValue);
      },
    );
  }

  Widget _buildSelectTile(SettingItem setting, SettingsController controller) {
    final value = controller.getSetting<String>(setting.key, setting.defaultValue.toString()) ?? setting.defaultValue.toString();
    
    return ListTile(
      title: Text(setting.name),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (setting.description != null) Text(setting.description!),
          Text('Current: ${setting.labels?[value] ?? value}'),
          if (setting.disableCache)
            Text(
              'Cache disabled',
              style: TextStyle(
                color: Colors.orange,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
            ),
        ],
      ),
      trailing: const Icon(Icons.arrow_forward_ios),
      onTap: () => _showSelectDialog(setting, controller, value),
    );
  }

  Widget _buildCheckboxTile(SettingItem setting, SettingsController controller) {
    final value = controller.getSetting<List<String>>(setting.key, <String>[]) ?? <String>[];
    
    return ExpansionTile(
      title: Text(setting.name),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (setting.description != null) Text(setting.description!),
          Text('Selected: ${value.length} items'),
          if (setting.disableCache)
            Text(
              'Cache disabled',
              style: TextStyle(
                color: Colors.orange,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
            ),
        ],
      ),
      children: setting.options?.map<Widget>((option) {
        final optionStr = option.toString();
        final isSelected = value.contains(optionStr);
        
        return CheckboxListTile(
          title: Text(setting.labels?[optionStr] ?? optionStr),
          value: isSelected,
          onChanged: (selected) async {
            final newValue = List<String>.from(value);
            if (selected == true) {
              newValue.add(optionStr);
            } else {
              newValue.remove(optionStr);
            }
            await controller.setSetting(setting.key, newValue);
          },
        );
      }).toList() ?? [],
    );
  }

  Widget _buildSliderTile(SettingItem setting, SettingsController controller) {
    final value = controller.getSetting<double>(setting.key, setting.defaultValue as double) ?? setting.defaultValue as double;
    
    return ListTile(
      title: Text(setting.name),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (setting.description != null) Text(setting.description!),
          Text('Value: ${value.toStringAsFixed(1)}'),
          if (setting.disableCache)
            Text(
              'Cache disabled',
              style: TextStyle(
                color: Colors.orange,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
            ),
          Slider(
            value: value,
            min: setting.minValue ?? 0.0,
            max: setting.maxValue ?? 100.0,
            divisions: ((setting.maxValue ?? 100.0) - (setting.minValue ?? 0.0)).round(),
            onChanged: (newValue) async {
              await controller.setSetting(setting.key, newValue);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildTextInputTile(SettingItem setting, SettingsController controller) {
    final value = controller.getSetting<String>(setting.key, setting.defaultValue.toString()) ?? setting.defaultValue.toString();
    
    return ListTile(
      title: Text(setting.name),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (setting.description != null) Text(setting.description!),
          Text('Value: $value'),
          if (setting.disableCache)
            Text(
              'Cache disabled',
              style: TextStyle(
                color: Colors.orange,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
            ),
        ],
      ),
      trailing: const Icon(Icons.edit),
      onTap: () => _showTextInputDialog(setting, controller, value),
    );
  }

  void _showSelectDialog(SettingItem setting, SettingsController controller, String currentValue) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(setting.name),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: setting.options?.map<Widget>((option) {
            final optionStr = option.toString();
            return RadioListTile<String>(
              title: Text(setting.labels?[optionStr] ?? optionStr),
              value: optionStr,
              groupValue: currentValue,
              onChanged: (value) async {
                if (value != null) {
                  await controller.setSetting(setting.key, value);
                  Navigator.of(context).pop();
                }
              },
            );
          }).toList() ?? [],
        ),
      ),
    );
  }

  void _showTextInputDialog(SettingItem setting, SettingsController controller, String currentValue) {
    final textController = TextEditingController(text: currentValue);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(setting.name),
        content: TextField(
          controller: textController,
          decoration: InputDecoration(
            labelText: setting.description,
            border: const OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              await controller.setSetting(setting.key, textController.text);
              Navigator.of(context).pop();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showDebugInfo() async {
    final controller = context.read<SettingsController>();
    final debugInfo = await controller.getDebugInfo();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Debug Info'),
        content: SingleChildScrollView(
          child: Text(debugInfo.toString()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _resetAllSettings() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reset All Settings'),
        content: const Text('Are you sure you want to reset all settings to their default values?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      setState(() => _isLoading = true);
      final controller = context.read<SettingsController>();
      await controller.resetAllSettings();
      setState(() => _isLoading = false);
    }
  }

  void _clearAllSettings() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear All Settings'),
        content: const Text('Are you sure you want to clear all settings from storage?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      setState(() => _isLoading = true);
      final controller = context.read<SettingsController>();
      await controller.clearAllSettings();
      setState(() => _isLoading = false);
    }
  }

  String _formatCategoryName(String category) {
    return category
        .split('_')
        .map((word) => word[0].toUpperCase() + word.substring(1))
        .join(' ');
  }
}
