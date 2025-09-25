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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

// AI MODIFICATION NOTE: This widget was created by QR_Profile_AI_Assistant
// - Modern card-based proxy setting components
// - Uses new theme system consistently
// - Enhanced user experience with better visual feedback
// Other AIs: Please maintain theme system consistency when modifying this widget

class ProxySettingCard extends StatelessWidget {
  final String title;
  final String? description;
  final Widget trailing;
  final VoidCallback? onTap;
  final bool isEnabled;
  final Widget? leading;

  const ProxySettingCard({
    super.key,
    required this.title,
    this.description,
    required this.trailing,
    this.onTap,
    this.isEnabled = true,
    this.leading,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing4,
        vertical: ThemeDimensions.spacing4,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
      ),
      child: InkWell(
        onTap: isEnabled ? onTap : null,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.spacing16),
          child: Row(
            children: [
              if (leading != null) ...[
                leading!,
                SizedBox(width: ThemeDimensions.spacing12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: ThemeTextStyles.bodyLarge.copyWith(
                        color: isEnabled ? ThemeColors.label : ThemeColors.tertiaryLabel,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (description != null) ...[
                      SizedBox(height: ThemeDimensions.spacing4),
                      Text(
                        description!,
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: isEnabled ? ThemeColors.secondaryLabel : ThemeColors.quaternaryLabel,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing12),
              trailing,
            ],
          ),
        ),
      ),
    );
  }
}

class ProxyToggleCard extends StatelessWidget {
  final String title;
  final String? description;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final bool isEnabled;
  final IconData? icon;

  const ProxyToggleCard({
    super.key,
    required this.title,
    this.description,
    required this.value,
    this.onChanged,
    this.isEnabled = true,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return ProxySettingCard(
      title: title,
      description: description,
      isEnabled: isEnabled,
      leading: icon != null
          ? Container(
              padding: EdgeInsets.all(ThemeDimensions.spacing8),
              decoration: BoxDecoration(
                color: ThemeColors.blue.withOpacity(0.1),
                borderRadius: BorderRadius.circular(ThemeDimensions.spacing8),
              ),
              child: Icon(
                icon,
                color: ThemeColors.blue,
                size: ThemeDimensions.iconSizeM,
              ),
            )
          : null,
      trailing: Switch(
        value: value,
        onChanged: isEnabled ? onChanged : null,
        activeColor: ThemeColors.green,
      ),
    );
  }
}

class ProxyActionCard extends StatelessWidget {
  final String title;
  final String? description;
  final IconData icon;
  final VoidCallback? onTap;
  final bool isEnabled;
  final Color? iconColor;

  const ProxyActionCard({
    super.key,
    required this.title,
    this.description,
    required this.icon,
    this.onTap,
    this.isEnabled = true,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveIconColor = iconColor ?? ThemeColors.blue;
    
    return ProxySettingCard(
      title: title,
      description: description,
      isEnabled: isEnabled,
      onTap: onTap,
      leading: Container(
        padding: EdgeInsets.all(ThemeDimensions.spacing8),
        decoration: BoxDecoration(
          color: effectiveIconColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(ThemeDimensions.spacing8),
        ),
        child: Icon(
          icon,
          color: effectiveIconColor,
          size: ThemeDimensions.iconSizeM,
        ),
      ),
      trailing: Icon(
        Icons.chevron_right,
        color: isEnabled ? ThemeColors.tertiaryLabel : ThemeColors.quaternaryLabel,
        size: ThemeDimensions.iconSizeM,
      ),
    );
  }
}

class ProxyInfoCard extends StatelessWidget {
  final String title;
  final String content;
  final IconData? icon;
  final Color? backgroundColor;

  const ProxyInfoCard({
    super.key,
    required this.title,
    required this.content,
    this.icon,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing4,
        vertical: ThemeDimensions.spacing4,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
      ),
      color: backgroundColor ?? ThemeColors.systemGroupedBackground,
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Icon(
                    icon,
                    color: ThemeColors.blue,
                    size: ThemeDimensions.iconSizeM,
                  ),
                  SizedBox(width: ThemeDimensions.spacing8),
                ],
                Text(
                  title,
                  style: ThemeTextStyles.titleSmall.copyWith(
                    fontWeight: FontWeight.bold,
                    color: ThemeColors.blue,
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacing12),
            Text(
              content,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.secondaryLabel,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ProxySectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;

  const ProxySectionHeader({
    super.key,
    required this.title,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        ThemeDimensions.spacing4,
        ThemeDimensions.spacing24,
        ThemeDimensions.spacing4,
        ThemeDimensions.spacing8,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: ThemeTextStyles.titleMedium.copyWith(
              fontWeight: FontWeight.bold,
              color: ThemeColors.blue,
            ),
          ),
          if (subtitle != null) ...[
            SizedBox(height: ThemeDimensions.spacing4),
            Text(
              subtitle!,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.secondaryLabel,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
