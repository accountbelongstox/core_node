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
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
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
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        child: Column(
          children: [
            _buildCertificate(),
            SizedBox(height: Dimensions.spacingLarge),
            _buildCertificateInfo(),
            SizedBox(height: Dimensions.spacingLarge),
            _buildActionButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildCertificate() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge * 2),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
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
            padding: EdgeInsets.all(Dimensions.paddingMedium),
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
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyCertificateOfCompletion.tr(context),
            style: TextStyles.h2.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: Dimensions.spacingLarge),
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
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyThisCertifies.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            _studentName,
            style: TextStyles.h2.copyWith(
              color: ThemeColors.primary,
              fontWeight: FontWeight.bold,
              fontStyle: FontStyle.italic,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyHasSuccessfullyCompleted.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            _courseName,
            style: TextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              Column(
                children: [
                  Text(
                    QyAppLocalizationKeys.qyCompletionDate.tr(context),
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textTertiary,
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    _completionDate,
                    style: TextStyles.body1.copyWith(
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
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textTertiary,
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Row(
                    children: [
                      Icon(Icons.star, size: 16, color: Colors.amber),
                      SizedBox(width: Dimensions.spacingXSmall),
                      Text(
                        '$_finalScore%',
                        style: TextStyles.body1.copyWith(
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
          SizedBox(height: Dimensions.spacingLarge),
          Container(
            height: 1,
            color: ThemeColors.border,
          ),
          SizedBox(height: Dimensions.spacingMedium),
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
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyInstructor.tr(context),
            style: TextStyles.caption.copyWith(
              color: ThemeColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCertificateInfo() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.verified, color: ThemeColors.success, size: 20),
              SizedBox(width: Dimensions.spacingSmall),
              Text(
                QyAppLocalizationKeys.qyVerifiedCertificate.tr(context),
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          _buildInfoRow(
            Icons.fingerprint,
            QyAppLocalizationKeys.qyCertificateId.tr(context),
            _certificateId,
          ),
          SizedBox(height: Dimensions.spacingSmall),
          _buildInfoRow(
            Icons.calendar_today,
            QyAppLocalizationKeys.qyIssued.tr(context),
            _completionDate,
          ),
          SizedBox(height: Dimensions.spacingSmall),
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
        SizedBox(width: Dimensions.spacingSmall),
        Text(
          '$label: ',
          style: TextStyles.body2.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyles.body2.copyWith(
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
                vertical: Dimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              ),
            ),
            icon: Icon(Icons.download, color: ThemeColors.surface),
            label: Text(
              QyAppLocalizationKeys.qyDownload.tr(context),
              style: TextStyles.button.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _shareCertificate,
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: ThemeColors.primary),
                  padding: EdgeInsets.symmetric(
                    vertical: Dimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  ),
                ),
                icon: Icon(Icons.share, color: ThemeColors.primary),
                label: Text(
                  QyAppLocalizationKeys.qyShare.tr(context),
                  style: TextStyles.button.copyWith(
                    color: ThemeColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: ThemeColors.primary),
                  padding: EdgeInsets.symmetric(
                    vertical: Dimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  ),
                ),
                icon: Icon(Icons.print, color: ThemeColors.primary),
                label: Text(
                  QyAppLocalizationKeys.qyPrint.tr(context),
                  style: TextStyles.button.copyWith(
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
