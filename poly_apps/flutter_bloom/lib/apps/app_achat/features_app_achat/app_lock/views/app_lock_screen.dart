import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/app_lock/controllers/app_lock_controller.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/app_lock/widgets/app_lock_settings_list.dart';

class AppLockScreen extends StatefulWidget {
  const AppLockScreen({super.key});

  @override
  State<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends State<AppLockScreen> {
  late AppLockController _controller;

  @override
  void initState() {
    super.initState();
    final settingsController = Provider.of<SettingsController>(context, listen: false);
    _controller = AppLockController(settingsController);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(
        title: 'achat_app_lock_title'.tr(context),
        showBackButton: true,
      ),
      body: ChangeNotifierProvider.value(
        value: _controller,
        child: Consumer<AppLockController>(
          builder: (context, controller, child) {
            return AppLockSettingsList(controller: controller);
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showResetDialog(context),
        icon: const Icon(Icons.refresh),
        label: const Text('Reset'),
        backgroundColor: Theme.of(context).colorScheme.secondary,
      ),
    );
  }

  void _showResetDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reset App Lock'),
        content: const Text('Are you sure you want to reset all app lock settings? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _controller.resetAppLock(context);
            },
            child: const Text('Reset'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
