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
import '../controllers/course_controller_app_qy.dart';

class CourseCertificateScreenRefactoredAppQy extends StatefulWidget {
  final String courseId;

  const CourseCertificateScreenRefactoredAppQy({
    super.key,
    required this.courseId,
  });

  @override
  State<CourseCertificateScreenRefactoredAppQy> createState() =>
      _CourseCertificateScreenRefactoredAppQyState();
}

class _CourseCertificateScreenRefactoredAppQyState
    extends State<CourseCertificateScreenRefactoredAppQy> {
  String _courseName = '';
  String _studentName = '';
  String _completionDate = '';
  String _certificateId = '';
  int _finalScore = 0;

  @override
  void initState() {
    super.initState();
    _initCertificateData();
  }

  void _initCertificateData() {
    _courseName = 'Business English Communication';
    _studentName = 'John Smith';
    _completionDate = '2024-02-28';
    _certificateId = 'CERT-QY-2024-001234';
    _finalScore = 92;
  }

  void _downloadCertificate() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyDownloading.tr(context)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _shareCertificate() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qySharing.tr(context)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyCertificate.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        actions: [
          IconButton(
            onPressed: _shareCertificate,
            icon: Icon(Icons.share, color: ThemeColors.textPrimary),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        child: Column(
          children: [
            _buildCertificate(),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildCertificateInfo(),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildActionButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildCertificate() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge * 2),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(color: ThemeColors.primary, width: 3),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.1),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.workspace_premium,
              size: 64,
              color: ThemeColors.primary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyCertificateOfCompletion.tr(context),
            style: ThemeTextStyles.h2.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Container(
            height: 2,
            width: 100,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  ThemeColors.primary.withOpacity(0),
                  ThemeColors.primary,
                  ThemeColors.primary.withOpacity(0),
                ],
              ),
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyThisCertifies.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            _studentName,
            style: ThemeTextStyles.h2.copyWith(
              color: ThemeColors.primary,
              fontWeight: FontWeight.bold,
              fontStyle: FontStyle.italic,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyHasSuccessfullyCompleted.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            _courseName,
            style: ThemeTextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              Column(
                children: [
                  Text(
                    QyAppLocalizationKeys.qyCompletionDate.tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ThemeColors.textTertiary,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacingXSmall),
                  Text(
                    _completionDate,
                    style: ThemeTextStyles.body1.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              Container(
                width: 1,
                height: 40,
                color: ThemeColors.border,
              ),
              Column(
                children: [
                  Text(
                    QyAppLocalizationKeys.qyFinalScore.tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ThemeColors.textTertiary,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacingXSmall),
                  Row(
                    children: [
                      Icon(Icons.star, size: 16, color: Colors.amber),
                      SizedBox(width: ThemeDimensions.spacingXSmall),
                      Text(
                        '$_finalScore%',
                        style: ThemeTextStyles.body1.copyWith(
                          color: ThemeColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Container(
            height: 1,
            color: ThemeColors.border,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 2,
                color: ThemeColors.textPrimary,
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyInstructor.tr(context),
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCertificateInfo() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.verified, color: ThemeColors.success, size: 20),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                QyAppLocalizationKeys.qyVerifiedCertificate.tr(context),
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildInfoRow(
            Icons.fingerprint,
            QyAppLocalizationKeys.qyCertificateId.tr(context),
            _certificateId,
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          _buildInfoRow(
            Icons.calendar_today,
            QyAppLocalizationKeys.qyIssued.tr(context),
            _completionDate,
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          _buildInfoRow(
            Icons.check_circle,
            QyAppLocalizationKeys.qyStatus.tr(context),
            QyAppLocalizationKeys.qyValid.tr(context),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: ThemeColors.textSecondary),
        SizedBox(width: ThemeDimensions.spacingSmall),
        Text(
          '$label: ',
          style: ThemeTextStyles.body2.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButtons() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _downloadCertificate,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primary,
              padding: EdgeInsets.symmetric(
                vertical: ThemeDimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
              ),
            ),
            icon: Icon(Icons.download, color: ThemeColors.surface),
            label: Text(
              QyAppLocalizationKeys.qyDownload.tr(context),
              style: ThemeTextStyles.button.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _shareCertificate,
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: ThemeColors.primary),
                  padding: EdgeInsets.symmetric(
                    vertical: ThemeDimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                  ),
                ),
                icon: Icon(Icons.share, color: ThemeColors.primary),
                label: Text(
                  QyAppLocalizationKeys.qyShare.tr(context),
                  style: ThemeTextStyles.button.copyWith(
                    color: ThemeColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            SizedBox(width: ThemeDimensions.spacingMedium),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: ThemeColors.primary),
                  padding: EdgeInsets.symmetric(
                    vertical: ThemeDimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                  ),
                ),
                icon: Icon(Icons.print, color: ThemeColors.primary),
                label: Text(
                  QyAppLocalizationKeys.qyPrint.tr(context),
                  style: ThemeTextStyles.button.copyWith(
                    color: ThemeColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
