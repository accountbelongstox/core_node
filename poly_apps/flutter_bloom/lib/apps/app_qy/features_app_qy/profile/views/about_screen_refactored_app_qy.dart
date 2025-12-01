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
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class AboutScreenRefactoredAppQy extends StatefulWidget {
  const AboutScreenRefactoredAppQy({super.key});

  @override
  State<AboutScreenRefactoredAppQy> createState() =>
      _AboutScreenRefactoredAppQyState();
}

class _AboutScreenRefactoredAppQyState
    extends State<AboutScreenRefactoredAppQy> {
  final String _appVersion = '1.0.0';
  final String _buildNumber = '100';
  final List<Map<String, String>> _teamMembers = [];
  final List<Map<String, String>> _features = [];

  @override
  void initState() {
    super.initState();
    _initTeamMembers();
    _initFeatures();
  }

  void _initTeamMembers() {
    _teamMembers.addAll([
      {'name': 'Development Team', 'role': 'Engineering'},
      {'name': 'Design Team', 'role': 'UI/UX'},
      {'name': 'Content Team', 'role': 'Education'},
    ]);
  }

  void _initFeatures() {
    _features.addAll([
      {'title': 'Word Learning', 'icon': 'book'},
      {'title': 'Listening Practice', 'icon': 'headset'},
      {'title': 'Reading Courses', 'icon': 'article'},
      {'title': 'AI Assistance', 'icon': 'psychology'},
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySettingsAbout.tr(context),
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
          _buildAppHeader(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildVersionInfo(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildFeaturesSection(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildTeamSection(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildLinksSection(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildLegalSection(),
          SizedBox(height: Dimensions.spacingLarge),
        ],
      ),
    );
  }

  Widget _buildAppHeader() {
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
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: ThemeColors.surface,
              borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
            ),
            child: Icon(
              Icons.school,
              size: 48,
              color: ThemeColors.primary,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            'QY English',
            style: TextStyles.h2.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingXSmall),
          Text(
            QyAppLocalizationKeys.qyAboutTagline.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildVersionInfo() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildInfoRow(
            Icons.info_outline,
            QyAppLocalizationKeys.qyAboutVersion.tr(context),
            _appVersion,
          ),
          Divider(color: ThemeColors.border),
          _buildInfoRow(
            Icons.build_circle_outlined,
            QyAppLocalizationKeys.qyAboutBuild.tr(context),
            _buildNumber,
          ),
          Divider(color: ThemeColors.border),
          _buildInfoRow(
            Icons.update,
            QyAppLocalizationKeys.qyAboutLastUpdate.tr(context),
            '2025-11-06',
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
      child: Row(
        children: [
          Icon(icon, color: ThemeColors.primary, size: 20),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Text(
              label,
              style: TextStyles.body1.copyWith(color: ThemeColors.textSecondary),
            ),
          ),
          Text(
            value,
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeaturesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyAboutFeatures.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: Dimensions.spacingMedium,
            mainAxisSpacing: Dimensions.spacingMedium,
            childAspectRatio: 1.5,
          ),
          itemCount: _features.length,
          itemBuilder: (context, index) {
            final feature = _features[index];
            return _buildFeatureCard(feature['title']!, _getIcon(feature['icon']!));
          },
        ),
      ],
    );
  }

  IconData _getIcon(String iconName) {
    switch (iconName) {
      case 'book':
        return Icons.menu_book;
      case 'headset':
        return Icons.headset;
      case 'article':
        return Icons.article;
      case 'psychology':
        return Icons.psychology;
      default:
        return Icons.star;
    }
  }

  Widget _buildFeatureCard(String title, IconData icon) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 32, color: ThemeColors.primary),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            title,
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildTeamSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyAboutTeam.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Container(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            border: Border.all(color: ThemeColors.border),
          ),
          child: Column(
            children: _teamMembers.asMap().entries.map((entry) {
              final index = entry.key;
              final member = entry.value;
              return Column(
                children: [
                  if (index > 0) Divider(color: ThemeColors.border),
                  _buildTeamMemberRow(member['name']!, member['role']!),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildTeamMemberRow(String name, String role) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.person, color: ThemeColors.primary, size: 24),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  role,
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLinksSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyAboutLinks.tr(context),
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
              _buildLinkTile(
                Icons.web,
                QyAppLocalizationKeys.qyAboutWebsite.tr(context),
                'https://qyenglish.com',
              ),
              Divider(height: 1, color: ThemeColors.border),
              _buildLinkTile(
                Icons.email,
                QyAppLocalizationKeys.qyAboutContact.tr(context),
                'support@qyenglish.com',
              ),
              Divider(height: 1, color: ThemeColors.border),
              _buildLinkTile(
                Icons.bug_report,
                QyAppLocalizationKeys.qyAboutFeedback.tr(context),
                QyAppLocalizationKeys.qyAboutReportIssue.tr(context),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLinkTile(IconData icon, String title, String subtitle) {
    return InkWell(
      onTap: () {},
      child: Padding(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(Dimensions.paddingSmall),
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
              ),
              child: Icon(icon, size: 20, color: ThemeColors.primary),
            ),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyles.body1.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    subtitle,
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: ThemeColors.textTertiary),
          ],
        ),
      ),
    );
  }

  Widget _buildLegalSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyAboutLegal.tr(context),
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
              _buildLegalTile(
                Icons.description,
                QyAppLocalizationKeys.qyAboutTerms.tr(context),
              ),
              Divider(height: 1, color: ThemeColors.border),
              _buildLegalTile(
                Icons.privacy_tip,
                QyAppLocalizationKeys.qySettingsPrivacy.tr(context),
              ),
              Divider(height: 1, color: ThemeColors.border),
              _buildLegalTile(
                Icons.copyright,
                QyAppLocalizationKeys.qyAboutLicense.tr(context),
              ),
            ],
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Center(
          child: Text(
            '© 2025 QY English. All rights reserved.',
            style: TextStyles.caption.copyWith(
              color: ThemeColors.textTertiary,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildLegalTile(IconData icon, String title) {
    return InkWell(
      onTap: () {},
      child: Padding(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        child: Row(
          children: [
            Icon(icon, size: 20, color: ThemeColors.textSecondary),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: Text(
                title,
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Icon(Icons.chevron_right, color: ThemeColors.textTertiary),
          ],
        ),
      ),
    );
  }
}
