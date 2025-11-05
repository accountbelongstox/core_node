// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// About Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class AboutScreenAppQy extends StatefulWidget {
  const AboutScreenAppQy({super.key});

  @override
  State<AboutScreenAppQy> createState() => _AboutScreenAppQyState();
}

class _AboutScreenAppQyState extends State<AboutScreenAppQy> {
  final String _version;
  final String _buildNumber;

  _AboutScreenAppQyState()
      : _version = '1.0.0',
        _buildNumber = '100';

  void _handleRateApp() {
    // TODO: Open app store for rating
  }

  void _handleFeedback() {
    // TODO: Open feedback form
  }

  void _handlePrivacyPolicy() {
    // TODO: Open privacy policy
  }

  void _handleTermsOfService() {
    // TODO: Open terms of service
  }

  void _handleContactUs() {
    // TODO: Open contact form
  }

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
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(height: Dimensions.spacingXLarge),
              _buildAppLogo(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildAppInfo(),
              SizedBox(height: Dimensions.spacingXLarge),
              _buildActionButtons(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildLegalLinks(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildCopyright(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppLogo() {
    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        color: ThemeColors.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
      ),
      child: Icon(
        Icons.book,
        size: 64,
        color: ThemeColors.primary,
      ),
    );
  }

  Widget _buildAppInfo() {
    return Column(
      children: [
        Text(
          QyAppLocalizationKeys.qyAppName.tr(context),
          style: TextStyles.h2.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Text(
          QyAppLocalizationKeys.qyAppDescription.tr(context),
          textAlign: TextAlign.center,
          style: TextStyles.body2.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Container(
          padding: EdgeInsets.symmetric(
            horizontal: Dimensions.paddingMedium,
            vertical: Dimensions.paddingSmall,
          ),
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
            border: Border.all(color: ThemeColors.border),
          ),
          child: Text(
            '${QyAppLocalizationKeys.qyVersion.tr(context)} $_version ($_buildNumber)',
            style: TextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButtons() {
    return Column(
      children: [
        _buildActionButton(
          Icons.star,
          QyAppLocalizationKeys.qyRateApp.tr(context),
          QyAppLocalizationKeys.qyRateAppDesc.tr(context),
          _handleRateApp,
        ),
        SizedBox(height: Dimensions.spacingSmall),
        _buildActionButton(
          Icons.feedback,
          QyAppLocalizationKeys.qyFeedback.tr(context),
          QyAppLocalizationKeys.qyFeedbackDesc.tr(context),
          _handleFeedback,
        ),
        SizedBox(height: Dimensions.spacingSmall),
        _buildActionButton(
          Icons.email,
          QyAppLocalizationKeys.qyContactUs.tr(context),
          QyAppLocalizationKeys.qyContactUsDesc.tr(context),
          _handleContactUs,
        ),
      ],
    );
  }

  Widget _buildActionButton(
    IconData icon,
    String title,
    String subtitle,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(color: ThemeColors.border),
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(Dimensions.paddingSmall),
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
              ),
              child: Icon(
                icon,
                color: ThemeColors.primary,
                size: 24,
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
            Icon(
              Icons.arrow_forward_ios,
              color: ThemeColors.textTertiary,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLegalLinks() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        TextButton(
          onPressed: _handlePrivacyPolicy,
          child: Text(
            QyAppLocalizationKeys.qyPrivacyPolicy.tr(context),
            style: TextStyles.caption.copyWith(
              color: ThemeColors.primary,
              decoration: TextDecoration.underline,
            ),
          ),
        ),
        Text(
          ' | ',
          style: TextStyles.caption.copyWith(
            color: ThemeColors.textTertiary,
          ),
        ),
        TextButton(
          onPressed: _handleTermsOfService,
          child: Text(
            QyAppLocalizationKeys.qyTermsOfService.tr(context),
            style: TextStyles.caption.copyWith(
              color: ThemeColors.primary,
              decoration: TextDecoration.underline,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCopyright() {
    return Text(
      '© 2025 QY. ${QyAppLocalizationKeys.qyAllRightsReserved.tr(context)}',
      textAlign: TextAlign.center,
      style: TextStyles.caption.copyWith(
        color: ThemeColors.textTertiary,
      ),
    );
  }
}
