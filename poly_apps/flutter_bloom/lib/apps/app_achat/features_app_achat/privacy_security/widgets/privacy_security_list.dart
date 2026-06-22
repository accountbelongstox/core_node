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
import 'package:qyflutter/apps/app_achat/features_app_achat/privacy_security/domain/model/privacy_security_model.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class PrivacySecurityList extends StatelessWidget {
  final PrivacySecurityModel settings;
  final Function(bool) onPhoneVisibilityChanged;
  final Function(bool) onOnlineStatusChanged;
  final Function(bool) onInviteControlChanged;
  final Function(bool) onDeleteAccountChanged;
  final Function(bool) onMessageEncryptionChanged;
  final Function(bool) onAccountProtectionChanged;
  final Function(bool) onAllowAddByPhoneChanged;
  final Function(bool) onAllowAddByIdChanged;
  final VoidCallback onBlockedUsersTap;
  final VoidCallback onLockCodeTap;
  final VoidCallback onDataUsageTap;
  final VoidCallback onPrivacyPolicyTap;
  final VoidCallback onSecurityTipsTap;

  const PrivacySecurityList({
    super.key,
    required this.settings,
    required this.onPhoneVisibilityChanged,
    required this.onOnlineStatusChanged,
    required this.onInviteControlChanged,
    required this.onDeleteAccountChanged,
    required this.onMessageEncryptionChanged,
    required this.onAccountProtectionChanged,
    required this.onAllowAddByPhoneChanged,
    required this.onAllowAddByIdChanged,
    required this.onBlockedUsersTap,
    required this.onLockCodeTap,
    required this.onDataUsageTap,
    required this.onPrivacyPolicyTap,
    required this.onSecurityTipsTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return ListView(
      padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      children: [
        _buildSectionHeader(context, 'achat_privacy_section_account'),
        _buildToggleTile(
          context,
          icon: Icons.security,
          iconColor: ThemeColors.primary,
          titleKey: 'achat_privacy_account_protect',
          descriptionKey: 'achat_privacy_account_protect_desc',
          enabled: settings.accountProtectionEnabled,
          onChanged: onAccountProtectionChanged,
        ),
        _buildToggleTile(
          context,
          icon: Icons.lock_outline,
          iconColor: ThemeColors.primary,
          titleKey: 'achat_privacy_message_encrypt',
          descriptionKey: 'achat_privacy_message_encrypt_desc',
          enabled: settings.messageEncryptionEnabled,
          onChanged: onMessageEncryptionChanged,
        ),
        
        const SizedBox(height: ThemeDimensions.paddingSizeLarge),
        _buildSectionHeader(context, 'achat_privacy_section_add_method'),
        _buildToggleTile(
          context,
          icon: Icons.phone_iphone,
          iconColor: ThemeColors.info,
          titleKey: 'achat_privacy_allow_add_by_phone',
          descriptionKey: 'achat_privacy_allow_add_by_phone_desc',
          enabled: settings.allowAddByPhone,
          onChanged: onAllowAddByPhoneChanged,
        ),
        _buildToggleTile(
          context,
          icon: Icons.badge,
          iconColor: ThemeColors.info,
          titleKey: 'achat_privacy_allow_add_by_id',
          descriptionKey: 'achat_privacy_allow_add_by_id_desc',
          enabled: settings.allowAddById,
          onChanged: onAllowAddByIdChanged,
        ),
        
        const SizedBox(height: ThemeDimensions.paddingSizeLarge),
        _buildSectionHeader(context, 'achat_privacy_section_security'),
        _buildNavigationTile(
          context,
          icon: Icons.block,
          iconColor: ThemeColors.error,
          titleKey: 'achat_privacy_blocked_users',
          onTap: onBlockedUsersTap,
        ),
        _buildNavigationTile(
          context,
          icon: Icons.lock,
          iconColor: ThemeColors.success,
          titleKey: 'achat_privacy_lock_code',
          onTap: onLockCodeTap,
        ),
        _buildSectionTip(context, 'achat_privacy_security_tip'),
        
        const SizedBox(height: ThemeDimensions.paddingSizeLarge),
        _buildSectionHeader(context, 'achat_privacy_section_privacy'),
        _buildToggleTile(
          context,
          icon: Icons.phone_iphone,
          iconColor: ThemeColors.warning,
          titleKey: 'achat_privacy_phone',
          enabled: settings.phoneVisibilityEnabled,
          onChanged: onPhoneVisibilityChanged,
        ),
        _buildToggleTile(
          context,
          icon: Icons.circle,
          iconColor: ThemeColors.warning,
          titleKey: 'achat_privacy_online_status',
          enabled: settings.onlineStatusEnabled,
          onChanged: onOnlineStatusChanged,
        ),
        _buildToggleTile(
          context,
          icon: Icons.person_add_alt_1,
          iconColor: ThemeColors.warning,
          titleKey: 'achat_privacy_invite_control',
          enabled: settings.inviteControlEnabled,
          onChanged: onInviteControlChanged,
        ),
        _buildSectionTip(context, 'achat_privacy_privacy_tip'),
        
        const SizedBox(height: ThemeDimensions.paddingSizeLarge),
        _buildSectionHeader(context, 'achat_privacy_section_manage'),
        _buildNavigationTile(
          context,
          icon: Icons.policy,
          iconColor: ThemeColors.purple,
          titleKey: 'achat_privacy_privacy_policy',
          onTap: onPrivacyPolicyTap,
        ),
        _buildNavigationTile(
          context,
          icon: Icons.security,
          iconColor: ThemeColors.purple,
          titleKey: 'achat_privacy_security_tips',
          onTap: onSecurityTipsTap,
        ),
        
        const SizedBox(height: ThemeDimensions.paddingSizeLarge),
        _buildSectionHeader(context, 'achat_privacy_section_advanced'),
        _buildToggleTile(
          context,
          icon: Icons.person_off,
          iconColor: ThemeColors.error,
          titleKey: 'achat_privacy_delete_account',
          enabled: settings.deleteAccountEnabled,
          onChanged: onDeleteAccountChanged,
        ),
        _buildNavigationTile(
          context,
          icon: Icons.storage,
          iconColor: ThemeColors.purple,
          titleKey: 'achat_privacy_data_usage',
          onTap: onDataUsageTap,
        ),
      ],
    );
  }

  Widget _buildSectionHeader(BuildContext context, String titleKey) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingSizeDefault,
        vertical: ThemeDimensions.spacingMedium,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
        borderRadius: BorderRadius.circular(ThemeDimensions.spacingMedium),
      ),
      child: Text(
        titleKey.tr(context),
        style: ThemeTextStyles.headline.copyWith(
          fontWeight: FontWeight.w600,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }

  Widget _buildSectionTip(BuildContext context, String tipKey) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: ThemeDimensions.paddingSizeSmall),
      padding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.spacingSmall),
        border: Border.all(
          color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Text(
        tipKey.tr(context),
        style: ThemeTextStyles.bodySmall.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          fontStyle: FontStyle.italic,
        ),
      ),
    );
  }

  Widget _buildToggleTile(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String titleKey,
    String? descriptionKey,
    required bool enabled,
    required Function(bool) onChanged,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: ThemeDimensions.paddingSizeSmall),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.spacingMedium),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(ThemeDimensions.spacingSmall),
          ),
          child: Icon(icon, color: iconColor, size: 24),
        ),
        title: Text(
          titleKey.tr(context),
          style: ThemeTextStyles.titleMedium.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
        subtitle: descriptionKey != null
            ? Padding(
                padding: const EdgeInsets.only(top: ThemeDimensions.paddingSizeSmall),
                child: Text(
                  descriptionKey.tr(context),
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              )
            : null,
        trailing: Switch(
          value: enabled,
          onChanged: onChanged,
          activeColor: ThemeColors.primary,
        ),
      ),
    );
  }

  Widget _buildNavigationTile(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String titleKey,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: ThemeDimensions.paddingSizeSmall),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.spacingMedium),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(ThemeDimensions.spacingMedium),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(ThemeDimensions.spacingSmall),
          ),
          child: Icon(icon, color: iconColor, size: 24),
        ),
        title: Text(
          titleKey.tr(context),
          style: ThemeTextStyles.titleMedium.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
        trailing: Icon(
          Icons.arrow_forward_ios,
          size: 16,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        onTap: onTap,
      ),
    );
  }
}
