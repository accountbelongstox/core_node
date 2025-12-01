/// Account settings screen
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../provider_app_qy/user_provider_app_qy.dart';
import '../widgets/settings_section.dart';
import '../widgets/settings_tile.dart';

class AccountSettingsScreen extends StatefulWidget {
  const AccountSettingsScreen({super.key});

  @override
  State<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

class _AccountSettingsScreenState extends State<AccountSettingsScreen> {
  late TextEditingController _usernameController;
  late TextEditingController _passwordController;

  @override
  void initState() {
    super.initState();
    _usernameController = TextEditingController();
    _passwordController = TextEditingController();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

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
              ColorsAppQy.qyPageBackground,
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
                    _buildAccountInfoSection(),
                    const SizedBox(height: 24),
                    _buildAccountBindingSection(),
                    const SizedBox(height: 24),
                    _buildAccountDeletionSection(),
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
              'settings.accountInfo'.tr(context),
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

  Widget _buildAccountInfoSection() {
    return Consumer<UserProviderAppQy>(
      builder: (context, userProvider, child) {
        final user = userProvider.currentUser;
        return SettingsSection(
          title: 'settings.account'.tr(context),
          child: Column(
            children: [
              SettingsTile(
                leading: Icon(
                  Icons.person_outline,
                  color: AppTheme.primaryGreen,
                ),
                title: 'settings.profile'.tr(context),
                subtitle: user?.displayName ?? 'Not set',
                trailing: TextButton(
                  onPressed: () => _showUsernameDialog(user?.displayName ?? ''),
                  child: Text(
                    QyAppLocalizationKeys.qySettingsModify.tr(context),
                    style: TextStyle(color: AppTheme.primaryGreen),
                  ),
                ),
              ),
              const Divider(height: 1, indent: 72),
              SettingsTile(
                leading: Icon(
                  Icons.lock_outline,
                  color: AppTheme.secondaryGreen,
                ),
                title: QyAppLocalizationKeys.qyPassword.tr(context),
                subtitle: '••••••••',
                trailing: TextButton(
                  onPressed: _showPasswordDialog,
                  child: Text(
                    QyAppLocalizationKeys.qySettingsModify.tr(context),
                    style: TextStyle(color: AppTheme.primaryGreen),
                  ),
                ),
              ),
              const Divider(height: 1, indent: 72),
              SettingsTile(
                leading: Icon(
                  Icons.phone_outlined,
                  color: AppTheme.accentGreen,
                ),
                title: QyAppLocalizationKeys.qyPhoneNumber.tr(context),
                subtitle: user?.phone != null
                    ? _maskPhoneNumber(user!.phone!)
                    : 'Not bound',
                trailing: TextButton(
                  onPressed: () => _showPhoneBindingDialog(),
                  child: Text(
                    user?.phone != null
                        ? QyAppLocalizationKeys.qySettingsRebind.tr(context)
                        : QyAppLocalizationKeys.qySettingsBind.tr(context),
                    style: TextStyle(color: AppTheme.primaryGreen),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAccountBindingSection() {
    return SettingsSection(
      title: QyAppLocalizationKeys.qySettingsAccountBinding.tr(context),
      child: Column(
        children: [
          Consumer<UserProviderAppQy>(
            builder: (context, userProvider, child) {
              final user = userProvider.currentUser;
              return SettingsTile(
                leading: Icon(
                  Icons.phone_android,
                  color: AppTheme.primaryGreen,
                ),
                title: QyAppLocalizationKeys.qySettingsPhone.tr(context),
                subtitle: user?.phone != null
                    ? _maskPhoneNumber(user!.phone!)
                    : QyAppLocalizationKeys.qySettingsNotBound.tr(context),
                trailing: TextButton(
                  onPressed: () => _showPhoneBindingDialog(),
                  child: Text(
                    user?.phone != null
                        ? QyAppLocalizationKeys.qySettingsRebind.tr(context)
                        : QyAppLocalizationKeys.qySettingsBind.tr(context),
                    style: TextStyle(color: AppTheme.primaryGreen),
                  ),
                ),
              );
            },
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.wechat,
              color: ColorsAppQy.qyWechatGreen,
            ),
            title: QyAppLocalizationKeys.qySettingsWechat.tr(context),
            subtitle: QyAppLocalizationKeys.qyWechatNickname.tr(context),
            trailing: TextButton(
              onPressed: () => _showWechatBindingDialog(),
              child: Text(
                QyAppLocalizationKeys.qySettingsRebind.tr(context),
                style: TextStyle(color: AppTheme.primaryGreen),
              ),
            ),
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.alternate_email,
              color: ColorsAppQy.qyWeiboOrange,
            ),
            title: QyAppLocalizationKeys.qySettingsWeibo.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsNotBound.tr(context),
            trailing: TextButton(
              onPressed: () => _showWeiboBindingDialog(),
              child: Text(
                QyAppLocalizationKeys.qySettingsBind.tr(context),
                style: TextStyle(color: AppTheme.primaryGreen),
              ),
            ),
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.chat,
              color: ColorsAppQy.qyQQBlue,
            ),
            title: QyAppLocalizationKeys.qySettingsQQ.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsNotBound.tr(context),
            trailing: TextButton(
              onPressed: () => _showQQBindingDialog(),
              child: Text(
                QyAppLocalizationKeys.qySettingsBind.tr(context),
                style: TextStyle(color: AppTheme.primaryGreen),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountDeletionSection() {
    return SettingsSection(
      title: QyAppLocalizationKeys.qySettingsAccountDeletion.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.warning_outlined,
              color: ColorsAppQy.qyError,
            ),
            title: QyAppLocalizationKeys.qySettingsAccountDeletion.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsAccountDeletionSubtitle
                .tr(context),
            trailing: TextButton(
              onPressed: _showAccountDeletionDialog,
              child: Text(
                QyAppLocalizationKeys.qySettingsDeleteAccount.tr(context),
                style: TextStyle(color: ColorsAppQy.qyError),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _maskPhoneNumber(String phone) {
    if (phone.length < 7) return phone;
    return '${phone.substring(0, 3)}****${phone.substring(phone.length - 4)}';
  }

  void _showUsernameDialog(String currentUsername) {
    _usernameController.text = currentUsername;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsChangeUsername.tr(context)),
        content: TextField(
          controller: _usernameController,
          decoration: InputDecoration(
            hintText:
                QyAppLocalizationKeys.qySettingsEnterNewUsername.tr(context),
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyCancel.tr(context)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(QyAppLocalizationKeys.qySettingsUsernameUpdated
                      .tr(context)),
                  backgroundColor: AppTheme.primaryGreen,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryGreen,
              foregroundColor: ColorsAppQy.qyTextOnPrimary,
            ),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showPasswordDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
            QyAppLocalizationKeys.qySettingsChangePasswordTitle.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: InputDecoration(
                hintText: QyAppLocalizationKeys.qySettingsEnterNewPassword
                    .tr(context),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              obscureText: true,
              decoration: InputDecoration(
                hintText: QyAppLocalizationKeys.qySettingsConfirmNewPassword
                    .tr(context),
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyCancel.tr(context)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(QyAppLocalizationKeys.qySettingsPasswordUpdated
                      .tr(context)),
                  backgroundColor: AppTheme.primaryGreen,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryGreen,
              foregroundColor: ColorsAppQy.qyTextOnPrimary,
            ),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showPhoneBindingDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsPhoneBinding.tr(context)),
        content: Text(
            QyAppLocalizationKeys.qySettingsPhoneBindingInProgress.tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showWechatBindingDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsWechatBinding.tr(context)),
        content: Text(QyAppLocalizationKeys.qySettingsWechatBindingInProgress
            .tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showWeiboBindingDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsWeiboBinding.tr(context)),
        content: Text(
            QyAppLocalizationKeys.qySettingsWeiboBindingInProgress.tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showQQBindingDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsQQBinding.tr(context)),
        content: Text(
            QyAppLocalizationKeys.qySettingsQQBindingInProgress.tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyOk.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showAccountDeletionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title:
            Text(QyAppLocalizationKeys.qySettingsAccountDeletion.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(QyAppLocalizationKeys.qySettingsDeletionWarning.tr(context)),
            const SizedBox(height: 16),
            Text(QyAppLocalizationKeys.qySettingsAfterDeletion.tr(context)),
            const SizedBox(height: 8),
            Text(
                '• ${QyAppLocalizationKeys.qySettingsDeletionDataLoss.tr(context)}'),
            Text(
                '• ${QyAppLocalizationKeys.qySettingsDeletionCourseLoss.tr(context)}'),
            Text(
                '• ${QyAppLocalizationKeys.qySettingsDeletionAccountClear.tr(context)}'),
            const SizedBox(height: 16),
            Text(QyAppLocalizationKeys.qySettingsConfirmDeletion.tr(context)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qyCancel.tr(context)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              _showFinalDeletionDialog();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ColorsAppQy.qyError,
              foregroundColor: ColorsAppQy.qyTextOnPrimary,
            ),
            child:
                Text(QyAppLocalizationKeys.qySettingsDeleteAccount.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showFinalDeletionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title:
            Text(QyAppLocalizationKeys.qySettingsFinalConfirmation.tr(context)),
        content: Text(QyAppLocalizationKeys.qySettingsFinalConfirmationMessage
            .tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(QyAppLocalizationKeys.qySettingsLetMeThink.tr(context)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(QyAppLocalizationKeys
                      .qySettingsAccountDeletionInProgress
                      .tr(context)),
                  backgroundColor: ColorsAppQy.qyError,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ColorsAppQy.qyError,
              foregroundColor: ColorsAppQy.qyTextOnPrimary,
            ),
            child:
                Text(QyAppLocalizationKeys.qySettingsDeleteAccount.tr(context)),
          ),
        ],
      ),
    );
  }
}
