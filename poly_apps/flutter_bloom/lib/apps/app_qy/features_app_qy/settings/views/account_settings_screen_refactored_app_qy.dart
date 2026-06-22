// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../models_app_qy/user_model_app_qy.dart';

class AccountSettingsScreenRefactoredAppQy extends StatefulWidget {
  const AccountSettingsScreenRefactoredAppQy({super.key});

  @override
  State<AccountSettingsScreenRefactoredAppQy> createState() =>
      _AccountSettingsScreenRefactoredAppQyState();
}

class _AccountSettingsScreenRefactoredAppQyState
    extends State<AccountSettingsScreenRefactoredAppQy> {
  final TextEditingController _nicknameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _loadUserData() {
    _nicknameController.text = 'QY User';
    _phoneController.text = '138****8888';
    _emailController.text = 'user@example.com';
  }

  void _showEditDialog({
    required String title,
    required TextEditingController controller,
    required VoidCallback onSave,
  }) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeColors.surface,
        title: Text(
          title,
          style: TextStyles.h4.copyWith(color: ThemeColors.textPrimary),
        ),
        content: TextField(
          controller: controller,
          style: TextStyles.body1.copyWith(color: ThemeColors.textPrimary),
          decoration: InputDecoration(
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              borderSide: BorderSide(color: ThemeColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              borderSide: BorderSide(color: ThemeColors.primary, width: 2),
            ),
            contentPadding: EdgeInsets.all(Dimensions.paddingMedium),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              QyAppLocalizationKeys.qyCommonCancel.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
              onSave();
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    QyAppLocalizationKeys.qySettingsAccountUpdateSuccess.tr(context),
                  ),
                ),
              );
            },
            child: Text(
              QyAppLocalizationKeys.qyCommonSave.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  void _showChangePasswordDialog() {
    final oldPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeColors.surface,
        title: Text(
          QyAppLocalizationKeys.qySettingsAccountChangePassword.tr(context),
          style: TextStyles.h4.copyWith(color: ThemeColors.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildPasswordField(
              controller: oldPasswordController,
              label: QyAppLocalizationKeys.qySettingsAccountOldPassword.tr(context),
            ),
            SizedBox(height: Dimensions.spacingMedium),
            _buildPasswordField(
              controller: newPasswordController,
              label: QyAppLocalizationKeys.qySettingsAccountNewPassword.tr(context),
            ),
            SizedBox(height: Dimensions.spacingMedium),
            _buildPasswordField(
              controller: confirmPasswordController,
              label: QyAppLocalizationKeys.qySettingsAccountConfirmPassword.tr(context),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              oldPasswordController.dispose();
              newPasswordController.dispose();
              confirmPasswordController.dispose();
              Navigator.pop(context);
            },
            child: Text(
              QyAppLocalizationKeys.qyCommonCancel.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
              if (newPasswordController.text == confirmPasswordController.text) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      QyAppLocalizationKeys.qySettingsAccountPasswordChanged.tr(context),
                    ),
                  ),
                );
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      QyAppLocalizationKeys.qySettingsAccountPasswordMismatch.tr(context),
                    ),
                    backgroundColor: ThemeColors.error,
                  ),
                );
              }
              oldPasswordController.dispose();
              newPasswordController.dispose();
              confirmPasswordController.dispose();
            },
            child: Text(
              QyAppLocalizationKeys.qyCommonSave.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String label,
  }) {
    return TextField(
      controller: controller,
      obscureText: true,
      style: TextStyles.body1.copyWith(color: ThemeColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          borderSide: BorderSide(color: ThemeColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          borderSide: BorderSide(color: ThemeColors.primary, width: 2),
        ),
        contentPadding: EdgeInsets.all(Dimensions.paddingMedium),
      ),
    );
  }

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeColors.surface,
        title: Text(
          QyAppLocalizationKeys.qySettingsAccountDeleteTitle.tr(context),
          style: TextStyles.h4.copyWith(color: ThemeColors.error),
        ),
        content: Text(
          QyAppLocalizationKeys.qySettingsAccountDeleteWarning.tr(context),
          style: TextStyles.body1.copyWith(color: ThemeColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              QyAppLocalizationKeys.qyCommonCancel.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
            },
            child: Text(
              QyAppLocalizationKeys.qyCommonDelete.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.error),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySettingsAccount.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        children: [
          _buildProfileHeader(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildInfoSection(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildSecuritySection(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildDangerZone(),
        ],
      ),
    );
  }

  Widget _buildProfileHeader() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary,
            ThemeColors.primary.withOpacity(0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.primary.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: ThemeColors.surface,
              shape: BoxShape.circle,
              border: Border.all(
                color: ThemeColors.surface,
                width: 3,
              ),
            ),
            child: Icon(
              Icons.person,
              size: 48,
              color: ThemeColors.primary,
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _nicknameController.text,
                  style: TextStyles.h3.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  'ID: 123456789',
                  style: TextStyles.body2.copyWith(
                    color: ThemeColors.surface.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () {},
            icon: Icon(
              Icons.edit,
              color: ThemeColors.surface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qySettingsAccountInfo.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Container(
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            border: Border.all(color: ThemeColors.border),
          ),
          child: Column(
            children: [
              _buildInfoTile(
                icon: Icons.person,
                title: QyAppLocalizationKeys.qySettingsAccountNickname.tr(context),
                value: _nicknameController.text,
                onTap: () => _showEditDialog(
                  title: QyAppLocalizationKeys.qySettingsAccountNickname.tr(context),
                  controller: _nicknameController,
                  onSave: () {},
                ),
              ),
              Divider(height: 1, color: ThemeColors.border),
              _buildInfoTile(
                icon: Icons.phone,
                title: QyAppLocalizationKeys.qySettingsAccountPhone.tr(context),
                value: _phoneController.text,
                onTap: () => _showEditDialog(
                  title: QyAppLocalizationKeys.qySettingsAccountPhone.tr(context),
                  controller: _phoneController,
                  onSave: () {},
                ),
              ),
              Divider(height: 1, color: ThemeColors.border),
              _buildInfoTile(
                icon: Icons.email,
                title: QyAppLocalizationKeys.qySettingsAccountEmail.tr(context),
                value: _emailController.text,
                onTap: () => _showEditDialog(
                  title: QyAppLocalizationKeys.qySettingsAccountEmail.tr(context),
                  controller: _emailController,
                  onSave: () {},
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSecuritySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qySettingsAccountSecurity.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Container(
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            border: Border.all(color: ThemeColors.border),
          ),
          child: Column(
            children: [
              _buildInfoTile(
                icon: Icons.lock,
                title: QyAppLocalizationKeys.qySettingsAccountChangePassword.tr(context),
                value: '••••••••',
                onTap: _showChangePasswordDialog,
              ),
              Divider(height: 1, color: ThemeColors.border),
              _buildInfoTile(
                icon: Icons.security,
                title: QyAppLocalizationKeys.qySettingsAccountTwoFactor.tr(context),
                value: QyAppLocalizationKeys.qySettingsAccountTwoFactorDisabled.tr(context),
                onTap: () {},
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDangerZone() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qySettingsAccountDangerZone.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.error,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Container(
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            border: Border.all(color: ThemeColors.error.withOpacity(0.3)),
          ),
          child: _buildInfoTile(
            icon: Icons.delete_forever,
            title: QyAppLocalizationKeys.qySettingsAccountDelete.tr(context),
            value: QyAppLocalizationKeys.qySettingsAccountDeleteDescription.tr(context),
            onTap: _showDeleteAccountDialog,
            textColor: ThemeColors.error,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required String title,
    required String value,
    required VoidCallback onTap,
    Color? textColor,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(Dimensions.paddingSmall),
              decoration: BoxDecoration(
                color: (textColor ?? ThemeColors.primary).withOpacity(0.1),
                borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
              ),
              child: Icon(
                icon,
                size: 20,
                color: textColor ?? ThemeColors.primary,
              ),
            ),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyles.body1.copyWith(
                      color: textColor ?? ThemeColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    value,
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: ThemeColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}
