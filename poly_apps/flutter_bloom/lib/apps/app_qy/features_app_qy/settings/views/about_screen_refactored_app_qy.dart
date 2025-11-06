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

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/settings_controller_app_qy.dart';

class AboutScreenRefactoredAppQy extends StatefulWidget {
  const AboutScreenRefactoredAppQy({super.key});

  @override
  State<AboutScreenRefactoredAppQy> createState() =>
      _AboutScreenRefactoredAppQyState();
}

class _AboutScreenRefactoredAppQyState extends State<AboutScreenRefactoredAppQy> {
  final String _version = '1.0.0';
  final String _buildNumber = '100';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyAbout.tr(context),
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
          _buildAppInfo(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildVersionInfo(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildLinks(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildLegal(),
        ],
      ),
    );
  }

  Widget _buildAppInfo() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge * 2),
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
      ),
      child: Column(
        children: [
          Container(
            padding: EdgeInsets.all(Dimensions.paddingLarge),
            decoration: BoxDecoration(
              color: ThemeColors.surface.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.school,
              size: 64,
              color: ThemeColors.surface,
            ),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyAppName.tr(context),
            style: TextStyles.h2.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyAppTagline.tr(context),
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
            QyAppLocalizationKeys.qyVersion.tr(context),
            _version,
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildInfoRow(
            Icons.build,
            QyAppLocalizationKeys.qyBuildNumber.tr(context),
            _buildNumber,
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildInfoRow(
            Icons.update,
            QyAppLocalizationKeys.qyLastUpdated.tr(context),
            '2024-03-01',
          ),
        ],
      ),
    );
  }

  Widget _buildLinks() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildLinkItem(
            Icons.language,
            QyAppLocalizationKeys.qyWebsite.tr(context),
            'www.qyenglish.com',
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildLinkItem(
            Icons.support_agent,
            QyAppLocalizationKeys.qySupport.tr(context),
            'support@qyenglish.com',
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildLinkItem(
            Icons.feedback,
            QyAppLocalizationKeys.qyFeedback.tr(context),
            QyAppLocalizationKeys.qySendFeedback.tr(context),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildLinkItem(
            Icons.star_rate,
            QyAppLocalizationKeys.qyRateUs.tr(context),
            QyAppLocalizationKeys.qyRateOnStore.tr(context),
          ),
        ],
      ),
    );
  }

  Widget _buildLegal() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildLinkItem(
            Icons.description,
            QyAppLocalizationKeys.qyTermsOfService.tr(context),
            QyAppLocalizationKeys.qyViewTerms.tr(context),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildLinkItem(
            Icons.privacy_tip,
            QyAppLocalizationKeys.qyPrivacyPolicy.tr(context),
            QyAppLocalizationKeys.qyViewPolicy.tr(context),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildLinkItem(
            Icons.copyright,
            QyAppLocalizationKeys.qyLicenses.tr(context),
            QyAppLocalizationKeys.qyViewLicenses.tr(context),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Row(
        children: [
          Icon(icon, size: 20, color: ThemeColors.textSecondary),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Text(
              label,
              style: TextStyles.body2.copyWith(
                color: ThemeColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLinkItem(IconData icon, String title, String subtitle) {
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
}
