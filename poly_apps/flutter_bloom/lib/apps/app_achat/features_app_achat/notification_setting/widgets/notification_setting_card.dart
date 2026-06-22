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
// - Modern card-based notification setting item
// - Uses new theme system consistently
// - Enhanced user experience with better visual feedback
// Other AIs: Please maintain theme system consistency when modifying this widget

class NotificationSettingCard extends StatelessWidget {
  final String title;
  final String? description;
  final Widget trailing;
  final VoidCallback? onTap;
  final bool isEnabled;

  const NotificationSettingCard({
    super.key,
    required this.title,
    this.description,
    required this.trailing,
    this.onTap,
    this.isEnabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
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

class NotificationSectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;

  const NotificationSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        ThemeDimensions.spacing16,
        ThemeDimensions.spacing24,
        ThemeDimensions.spacing16,
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

class NotificationToggleCard extends StatelessWidget {
  final String title;
  final String? description;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final bool isEnabled;

  const NotificationToggleCard({
    super.key,
    required this.title,
    this.description,
    required this.value,
    this.onChanged,
    this.isEnabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return NotificationSettingCard(
      title: title,
      description: description,
      isEnabled: isEnabled,
      trailing: Switch(
        value: value,
        onChanged: isEnabled ? onChanged : null,
        activeColor: ThemeColors.green,
      ),
    );
  }
}

class NotificationSelectCard extends StatelessWidget {
  final String title;
  final String? description;
  final String currentValue;
  final VoidCallback? onTap;
  final bool isEnabled;

  const NotificationSelectCard({
    super.key,
    required this.title,
    this.description,
    required this.currentValue,
    this.onTap,
    this.isEnabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return NotificationSettingCard(
      title: title,
      description: description,
      isEnabled: isEnabled,
      onTap: onTap,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            currentValue,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: isEnabled ? ThemeColors.blue : ThemeColors.quaternaryLabel,
              fontWeight: FontWeight.w500,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacing4),
          Icon(
            Icons.chevron_right,
            color: isEnabled ? ThemeColors.tertiaryLabel : ThemeColors.quaternaryLabel,
            size: ThemeDimensions.iconSizeM,
          ),
        ],
      ),
    );
  }
}

class NotificationFooterNote extends StatelessWidget {
  final String text;

  const NotificationFooterNote({
    super.key,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.spacing16),
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      decoration: BoxDecoration(
        color: ThemeColors.systemGroupedBackground,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline,
            color: ThemeColors.blue,
            size: ThemeDimensions.iconSizeM,
          ),
          SizedBox(width: ThemeDimensions.spacing12),
          Expanded(
            child: Text(
              text,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.secondaryLabel,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
