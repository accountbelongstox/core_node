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
import 'package:qyflutter/common/widgets/back_app_bar.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/common_widgets/bottom_navigation/common_bottom_navigation.dart';
// AI: Claude Code - Updated to use common BackAppBar instead of app-specific duplicate
import 'package:qyflutter/apps/app_achat/features_app_achat/privacy_security/domain/model/privacy_security_model.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/privacy_security/domain/service/privacy_security_service.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/privacy_security/widgets/privacy_security_list.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class PrivacySecurityScreen extends StatefulWidget {
  const PrivacySecurityScreen({super.key});

  @override
  State<PrivacySecurityScreen> createState() => _PrivacySecurityScreenState();
}

class _PrivacySecurityScreenState extends State<PrivacySecurityScreen> {
  final _service = PrivacySecurityService();
  late PrivacySecurityModel _settings = PrivacySecurityModel.defaultSettings();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final settings = await _service.getSettings();
      if (mounted) {
        setState(() {
          _settings = settings;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('achat_privacy_load_error'.tr(context))),
        );
      }
    }
  }

  Future<void> _updatePhoneVisibility(bool enabled) async {
    await _service.updatePhoneVisibility(context, enabled);
    setState(() {
      _settings = _settings.copyWith(phoneVisibilityEnabled: enabled);
    });
  }

  Future<void> _updateOnlineStatus(bool enabled) async {
    await _service.updateOnlineStatus(context, enabled);
    setState(() {
      _settings = _settings.copyWith(onlineStatusEnabled: enabled);
    });
  }

  Future<void> _updateInviteControl(bool enabled) async {
    await _service.updateInviteControl(context, enabled);
    setState(() {
      _settings = _settings.copyWith(inviteControlEnabled: enabled);
    });
  }

  Future<void> _updateDeleteAccount(bool enabled) async {
    await _service.updateDeleteAccount(context, enabled);
    setState(() {
      _settings = _settings.copyWith(deleteAccountEnabled: enabled);
    });
  }

  Future<void> _updateMessageEncryption(bool enabled) async {
    await _service.updateMessageEncryption(context, enabled);
    setState(() {
      _settings = _settings.copyWith(messageEncryptionEnabled: enabled);
    });
  }

  Future<void> _updateAccountProtection(bool enabled) async {
    await _service.updateAccountProtection(context, enabled);
    setState(() {
      _settings = _settings.copyWith(accountProtectionEnabled: enabled);
    });
  }

  Future<void> _updateAllowAddByPhone(bool enabled) async {
    await _service.updateAllowAddByPhone(context, enabled);
    setState(() {
      _settings = _settings.copyWith(allowAddByPhone: enabled);
    });
  }

  Future<void> _updateAllowAddById(bool enabled) async {
    await _service.updateAllowAddById(context, enabled);
    setState(() {
      _settings = _settings.copyWith(allowAddById: enabled);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: const BackAppBar(
        title: 'achat_privacy_title',
        titleSize: 20,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(),
            )
          : PrivacySecurityList(
              settings: _settings,
              onPhoneVisibilityChanged: _updatePhoneVisibility,
              onOnlineStatusChanged: _updateOnlineStatus,
              onInviteControlChanged: _updateInviteControl,
              onDeleteAccountChanged: _updateDeleteAccount,
              onMessageEncryptionChanged: _updateMessageEncryption,
              onAccountProtectionChanged: _updateAccountProtection,
              onAllowAddByPhoneChanged: _updateAllowAddByPhone,
              onAllowAddByIdChanged: _updateAllowAddById,
              onBlockedUsersTap: () => _service.navigateToBlockedUsers(context),
              onLockCodeTap: () => _service.navigateToLockCode(context),
              onDataUsageTap: () => _service.navigateToDataUsage(context),
              onPrivacyPolicyTap: () => _service.navigateToPrivacyPolicy(context),
              onSecurityTipsTap: () => _service.navigateToSecurityTips(context),
      ),
      bottomNavigationBar: const CommonBottomNavigation(currentIndex: 3),
    );
  }
}
