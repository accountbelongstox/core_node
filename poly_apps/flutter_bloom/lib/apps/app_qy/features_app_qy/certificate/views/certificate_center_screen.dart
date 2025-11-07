library;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../models/certificate_model.dart';
import '../services/certificate_service.dart';

class CertificateCenterScreen extends StatefulWidget {
  const CertificateCenterScreen({super.key});

  @override
  State<CertificateCenterScreen> createState() => _CertificateCenterScreenState();
}

class _CertificateCenterScreenState extends State<CertificateCenterScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  final CertificateService _certificateService = CertificateService();
  late List<CertificateModel> _certificates;
  late CertificateStats _stats;

  @override
  void initState() {
    super.initState();
    _certificates = _certificateService.getAllCertificates();
    _stats = _certificateService.getCertificateStats();

    _controller = AnimationController(
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.primaryCurve),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
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
              AppTheme.midnightGradient.colors[0].withOpacity(0.15),
              AppTheme.midnightGradient.colors[1].withOpacity(0.08),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Column(
              children: [
                _buildAppBar(),
                _buildStatsHeader(),
                Expanded(
                  child: _buildCertificatesGrid(),
                ),
              ],
            ),
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
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Icon(
              Icons.arrow_back,
              color: AppTheme.textPrimary,
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  QyAppLocalizationKeys.qyCertificateCenter.tr,
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyCertificateCenterSubtitle.tr,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _showShareOptions,
            child: Icon(
              Icons.share,
              color: AppTheme.primaryGreen,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsHeader() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppTheme.midnightGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildStatItem(
              QyAppLocalizationKeys.qyCertificateEarned.tr,
              '${_stats.earnedCount}',
              Icons.workspace_premium,
              Colors.white,
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withOpacity(0.3),
          ),
          Expanded(
            child: _buildStatItem(
              QyAppLocalizationKeys.qyCertificateInProgress.tr,
              '${_stats.inProgressCount}',
              Icons.pending,
              Colors.white,
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withOpacity(0.3),
          ),
          Expanded(
            child: _buildStatItem(
              QyAppLocalizationKeys.qyCertificateTotalPoints.tr,
              '${_stats.totalPoints}',
              Icons.trending_up,
              Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 8),
        Text(
          value,
          style: AppTextStyles.headline4.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: AppTextStyles.bodySmall.copyWith(
            color: color.withOpacity(0.9),
          ),
        ),
      ],
    );
  }

  Widget _buildCertificatesGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.85,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
      ),
      itemCount: _certificates.length,
      itemBuilder: (context, index) {
        final certificate = _certificates[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: _buildCertificateCard(certificate, index),
        );
      },
    );
  }

  Widget _buildCertificateCard(CertificateModel certificate, int index) {
    final isLocked = certificate.locked;

    return BouncingButton(
      onPressed: isLocked ? _showLockedMessage : () => _viewCertificate(certificate),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: isLocked
              ? LinearGradient(
                  colors: [Colors.grey.shade300, Colors.grey.shade200],
                )
              : certificate.color == AppTheme.darkGreen
                  ? AppTheme.midnightGradient
                  : LinearGradient(
                      colors: [
                        certificate.color.withOpacity(0.2),
                        certificate.color.withOpacity(0.1),
                      ],
                    ),
          border: Border.all(
            color: isLocked ? Colors.grey.shade400 : Colors.transparent,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: isLocked
                  ? Colors.grey.shade300
                  : certificate.color.withOpacity(0.3),
              blurRadius: isLocked ? 8 : 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: isLocked
                ? LinearGradient(
                    colors: [Colors.grey.shade50, Colors.white],
                  )
                : LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.white.withOpacity(0.9),
                      Colors.white.withOpacity(0.7),
                    ],
                  ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: isLocked
                          ? Colors.grey.shade200
                          : certificate.color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: isLocked
                        ? Icon(
                            Icons.lock,
                            color: Colors.grey.shade400,
                            size: 24,
                          )
                        : Icon(
                            certificate.icon,
                            color: certificate.color,
                            size: 24,
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                certificate.titleKey.tr,
                                style: AppTextStyles.bodyLarge.copyWith(
                                  color: isLocked
                                      ? Colors.grey.shade600
                                      : AppTheme.textPrimary,
                                  fontWeight: FontWeight.bold,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (!isLocked && certificate.badge != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: certificate.color,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  _getBadgeText(certificate.badge!),
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _getLevelText(certificate.level),
                          style: AppTextStyles.bodySmall.copyWith(
                            color: isLocked
                                ? Colors.grey.shade500
                                : certificate.color,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                certificate.descriptionKey.tr,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: isLocked
                      ? Colors.grey.shade500
                      : AppTheme.textSecondary,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              if (!isLocked && certificate.earnedDate != null) ...[
                Row(
                  children: [
                    Icon(
                      Icons.calendar_today,
                      color: AppTheme.textHint,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${QyAppLocalizationKeys.qyCertificateEarnedDate.tr}: ${_formatDate(certificate.earnedDate!)}',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
              if (isLocked) ...[
                Row(
                  children: [
                    Icon(
                      Icons.lock_outline,
                      color: Colors.grey.shade400,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      QyAppLocalizationKeys.qyCertificateLocked.tr,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _getLevelText(CertificateLevel level) {
    switch (level) {
      case CertificateLevel.beginner:
        return QyAppLocalizationKeys.qyCertificateLevelBeginner.tr;
      case CertificateLevel.intermediate:
        return QyAppLocalizationKeys.qyCertificateLevelIntermediate.tr;
      case CertificateLevel.advanced:
        return QyAppLocalizationKeys.qyCertificateLevelAdvanced.tr;
      case CertificateLevel.expert:
        return QyAppLocalizationKeys.qyCertificateLevelExpert.tr;
    }
  }

  String _getBadgeText(CertificateBadge badge) {
    switch (badge) {
      case CertificateBadge.newbie:
        return QyAppLocalizationKeys.qyCertificateBadgeNewbie.tr;
      case CertificateBadge.diligent:
        return QyAppLocalizationKeys.qyCertificateBadgeDiligent.tr;
      case CertificateBadge.persistent:
        return QyAppLocalizationKeys.qyCertificateBadgePersistent.tr;
      case CertificateBadge.perfectAttendance:
        return QyAppLocalizationKeys.qyCertificateBadgePerfectAttendance.tr;
      case CertificateBadge.expert:
        return QyAppLocalizationKeys.qyCertificateBadgeExpert.tr;
      case CertificateBadge.excellent:
        return QyAppLocalizationKeys.qyCertificateBadgeExcellent.tr;
    }
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  void _viewCertificate(CertificateModel certificate) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => CertificateDetailScreen(certificate: certificate),
      ),
    );
  }

  void _showLockedMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyCertificateKeepWorking.tr),
        backgroundColor: AppTheme.warning,
      ),
    );
  }

  void _showShareOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.borderLight,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            _buildShareOption(
              QyAppLocalizationKeys.qyCertificateShareToWechat.tr,
              Icons.chat,
              () {},
            ),
            _buildShareOption(
              QyAppLocalizationKeys.qyCertificateShareToMoments.tr,
              Icons.public,
              () {},
            ),
            _buildShareOption(
              QyAppLocalizationKeys.qyCertificateSaveImage.tr,
              Icons.save_alt,
              () {},
            ),
            _buildShareOption(
              QyAppLocalizationKeys.qyCertificateCopyLink.tr,
              Icons.link,
              () {},
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildShareOption(String title, IconData icon, VoidCallback onTap) {
    return BouncingButton(
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppTheme.surfaceLight,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                icon,
                color: AppTheme.textSecondary,
                size: 18,
              ),
            ),
            const SizedBox(width: 16),
            Text(
              title,
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CertificateDetailScreen extends StatelessWidget {
  final CertificateModel certificate;

  const CertificateDetailScreen({
    super.key,
    required this.certificate,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: Text(
          certificate.titleKey.tr,
          style: AppTextStyles.headline5.copyWith(
            color: Colors.white,
          ),
        ),
        backgroundColor: certificate.color,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.download, color: Colors.white),
            onPressed: () => _downloadCertificate(context),
          ),
          IconButton(
            icon: const Icon(Icons.share, color: Colors.white),
            onPressed: () => _shareCertificate(context),
          ),
        ],
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: certificate.color == AppTheme.darkGreen
              ? AppTheme.midnightGradient
              : LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    certificate.color.withOpacity(0.1),
                    Colors.white,
                  ],
                ),
        ),
        child: Center(
          child: Container(
            width: MediaQuery.of(context).size.width * 0.9,
            height: MediaQuery.of(context).size.height * 0.7,
            margin: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.workspace_premium,
                        color: certificate.color,
                        size: 80,
                      ),
                      const SizedBox(height: 20),
                      Text(
                        certificate.titleKey.tr,
                        style: AppTextStyles.headline3.copyWith(
                          color: certificate.color,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _getLevelText(certificate.level),
                        style: AppTextStyles.headline5.copyWith(
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (certificate.earnedDate != null)
                        Text(
                          '${QyAppLocalizationKeys.qyCertificateIssueDate.tr}${_formatDate(certificate.earnedDate!)}',
                          style: AppTextStyles.bodyLarge.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      const SizedBox(height: 32),
                      Text(
                        '${QyAppLocalizationKeys.qyCertificateNumber.tr}${DateTime.now().millisecondsSinceEpoch}',
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: AppTheme.textHint,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  margin: const EdgeInsets.all(20),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: certificate.color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: certificate.color.withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyCertificateDescription.tr,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: certificate.color,
                      height: 1.6,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _getLevelText(CertificateLevel level) {
    switch (level) {
      case CertificateLevel.beginner:
        return QyAppLocalizationKeys.qyCertificateLevelBeginner.tr;
      case CertificateLevel.intermediate:
        return QyAppLocalizationKeys.qyCertificateLevelIntermediate.tr;
      case CertificateLevel.advanced:
        return QyAppLocalizationKeys.qyCertificateLevelAdvanced.tr;
      case CertificateLevel.expert:
        return QyAppLocalizationKeys.qyCertificateLevelExpert.tr;
    }
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  void _downloadCertificate(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyCertificateDownloadInProgress.tr),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _shareCertificate(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyCertificateShareInProgress.tr),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }
}
