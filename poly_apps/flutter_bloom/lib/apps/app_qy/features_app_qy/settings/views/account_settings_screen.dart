/// Account settings screen
library account_settings_screen;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../provider_app_qy/user_provider_app_qy.dart';
import 'widgets/settings_section.dart';
import 'widgets/settings_tile.dart';

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
              'settings.accountInfo'.tr,
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
          title: 'settings.account'.tr,
          child: Column(
            children: [
              SettingsTile(
                leading: Icon(
                  Icons.person_outline,
                  color: AppTheme.primaryGreen,
                ),
                title: 'settings.profile'.tr,
                subtitle: user?.displayName ?? 'Not set',
                trailing: TextButton(
                  onPressed: () => _showUsernameDialog(user?.displayName ?? ''),
                  child: Text(
                    '修改',
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
                title: '密码',
                subtitle: '••••••••',
                trailing: TextButton(
                  onPressed: _showPasswordDialog,
                  child: Text(
                    '修改',
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
                title: '手机号',
                subtitle: user?.phone != null
                    ? _maskPhoneNumber(user!.phone!)
                    : 'Not bound',
                trailing: TextButton(
                  onPressed: () => _showPhoneBindingDialog(),
                  child: Text(
                    user?.phone != null ? '换绑' : '绑定',
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
      title: '账号绑定',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.phone_android,
              color: AppTheme.primaryGreen,
            ),
            title: '手机',
            subtitle: Consumer<UserProviderAppQy>(
              builder: (context, userProvider, child) {
                final user = userProvider.currentUser;
                return user?.phone != null
                    ? _maskPhoneNumber(user!.phone!)
                    : '尚未绑定';
              },
            ),
            trailing: Consumer<UserProviderAppQy>(
              builder: (context, userProvider, child) {
                final user = userProvider.currentUser;
                return TextButton(
                  onPressed: () => _showPhoneBindingDialog(),
                  child: Text(
                    user?.phone != null ? '换绑' : '绑定',
                    style: TextStyle(color: AppTheme.primaryGreen),
                  ),
                );
              },
            ),
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.wechat,
              color: const Color(0xFF07C160),
            ),
            title: '微信',
            subtitle: '蓦然回首',
            trailing: TextButton(
              onPressed: () => _showWechatBindingDialog(),
              child: Text(
                '换绑',
                style: TextStyle(color: AppTheme.primaryGreen),
              ),
            ),
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.alternate_email,
              color: const Color(0xFFFF8140),
            ),
            title: '新浪微博',
            subtitle: '尚未绑定',
            trailing: TextButton(
              onPressed: () => _showWeiboBindingDialog(),
              child: Text(
                '绑定',
                style: TextStyle(color: AppTheme.primaryGreen),
              ),
            ),
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.chat,
              color: const Color(0xFF1296DB),
            ),
            title: 'QQ',
            subtitle: '尚未绑定',
            trailing: TextButton(
              onPressed: () => _showQQBindingDialog(),
              child: Text(
                '绑定',
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
      title: '账号注销',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.warning_outlined,
              color: Colors.red,
            ),
            title: '账号注销',
            subtitle: '删除所有数据，永久注销',
            trailing: TextButton(
              onPressed: _showAccountDeletionDialog,
              child: Text(
                '注销',
                style: TextStyle(color: Colors.red),
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
        title: Text('修改用户名'),
        content: TextField(
          controller: _usernameController,
          decoration: InputDecoration(
            hintText: '请输入新用户名',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('取消'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('用户名已更新'),
                  backgroundColor: AppTheme.primaryGreen,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryGreen,
              foregroundColor: Colors.white,
            ),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }

  void _showPasswordDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('修改密码'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: InputDecoration(
                hintText: '请输入新密码',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              obscureText: true,
              decoration: InputDecoration(
                hintText: '请确认新密码',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('取消'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('密码已更新'),
                  backgroundColor: AppTheme.primaryGreen,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryGreen,
              foregroundColor: Colors.white,
            ),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }

  void _showPhoneBindingDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('手机号绑定'),
        content: Text('手机号绑定功能开发中...'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }

  void _showWechatBindingDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('微信绑定'),
        content: Text('微信绑定功能开发中...'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }

  void _showWeiboBindingDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('微博绑定'),
        content: Text('微博绑定功能开发中...'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }

  void _showQQBindingDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('QQ绑定'),
        content: Text('QQ绑定功能开发中...'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('确定'),
          ),
        ],
      ),
    );
  }

  void _showAccountDeletionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('账号注销'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('警告：此操作不可恢复！'),
            const SizedBox(height: 16),
            Text('注销账号后：'),
            const SizedBox(height: 8),
            Text('• 所有学习数据将被永久删除'),
            Text('• 购买的课程和服务将无法使用'),
            Text('• 账户信息将被彻底清除'),
            const SizedBox(height: 16),
            Text('确定要注销账号吗？'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('取消'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              _showFinalDeletionDialog();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: Text('确认注销'),
          ),
        ],
      ),
    );
  }

  void _showFinalDeletionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('最终确认'),
        content: Text('请再次确认：您真的要永久注销账号吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('我再想想'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('账号注销功能开发中...'),
                  backgroundColor: Colors.red,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: Text('确认注销'),
          ),
        ],
      ),
    );
  }
}