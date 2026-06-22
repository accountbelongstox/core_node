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
import 'package:intl/intl.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/profile_controller_app_qy.dart';
import '../domain/model/profile_model.dart';

class CertificateCenterScreenRefactoredAppQy extends StatefulWidget {
  const CertificateCenterScreenRefactoredAppQy({super.key});

  @override
  State<CertificateCenterScreenRefactoredAppQy> createState() =>
      _CertificateCenterScreenRefactoredAppQyState();
}

class _CertificateCenterScreenRefactoredAppQyState
    extends State<CertificateCenterScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = context.read<ProfileControllerAppQy>();
      controller.loadCertificates();
      controller.loadAchievements();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyCertificateCenter.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: ThemeColors.primary,
          labelColor: ThemeColors.primary,
          unselectedLabelColor: ThemeColors.textSecondary,
          labelStyle: TextStyles.body1.copyWith(fontWeight: FontWeight.w600),
          unselectedLabelStyle: TextStyles.body1,
          tabs: [
            Tab(text: QyAppLocalizationKeys.qyCertificates.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyAchievements.tr(context)),
          ],
        ),
      ),
      body: Consumer<ProfileControllerAppQy>(
        builder: (context, controller, child) {
          if (controller.isLoading) {
            return Center(
              child: CircularProgressIndicator(color: ThemeColors.primary),
            );
          }

          return TabBarView(
            controller: _tabController,
            children: [
              _buildCertificatesTab(controller),
              _buildAchievementsTab(controller),
            ],
          );
        },
      ),
    );
  }

  Widget _buildCertificatesTab(ProfileControllerAppQy controller) {
    final certificates = controller.certificates;

    if (certificates.isEmpty) {
      return _buildEmptyState(
        Icons.workspace_premium,
        QyAppLocalizationKeys.qyNoCertificates.tr(context),
        QyAppLocalizationKeys.qyNoCertificatesDescription.tr(context),
      );
    }

    return ListView.builder(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      itemCount: certificates.length,
      itemBuilder: (context, index) {
        return _buildCertificateCard(certificates[index]);
      },
    );
  }

  Widget _buildCertificateCard(CertificateModel certificate) {
    final dateFormat = DateFormat('yyyy-MM-dd');

    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary.withOpacity(0.1),
            ThemeColors.primary.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.primary.withOpacity(0.3)),
      ),
      child: Padding(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: EdgeInsets.all(Dimensions.paddingMedium),
                  decoration: BoxDecoration(
                    color: ThemeColors.primary,
                    borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  ),
                  child: Icon(
                    Icons.workspace_premium,
                    size: 32,
                    color: ThemeColors.surface,
                  ),
                ),
                SizedBox(width: Dimensions.spacingMedium),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        certificate.title,
                        style: TextStyles.body1.copyWith(
                          color: ThemeColors.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: Dimensions.spacingXSmall),
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: Dimensions.paddingSmall,
                          vertical: Dimensions.paddingXSmall,
                        ),
                        decoration: BoxDecoration(
                          color: ThemeColors.primary.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                        ),
                        child: Text(
                          certificate.category,
                          style: TextStyles.caption.copyWith(
                            color: ThemeColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  children: [
                    Text(
                      '${certificate.score}',
                      style: TextStyles.h2.copyWith(
                        color: ThemeColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      QyAppLocalizationKeys.qyScore.tr(context),
                      style: TextStyles.caption.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Text(
              certificate.description,
              style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Divider(color: ThemeColors.border),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.calendar_today,
                      size: 16,
                      color: ThemeColors.textTertiary,
                    ),
                    SizedBox(width: Dimensions.spacingXSmall),
                    Text(
                      dateFormat.format(certificate.issuedAt),
                      style: TextStyles.caption.copyWith(
                        color: ThemeColors.textTertiary,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Icon(
                      Icons.numbers,
                      size: 16,
                      color: ThemeColors.textTertiary,
                    ),
                    SizedBox(width: Dimensions.spacingXSmall),
                    Text(
                      certificate.certificateNumber,
                      style: TextStyles.caption.copyWith(
                        color: ThemeColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAchievementsTab(ProfileControllerAppQy controller) {
    final unlockedAchievements = controller.unlockedAchievements;
    final lockedAchievements = controller.lockedAchievements;
    final totalAchievements = controller.totalAchievements;
    final unlockedCount = controller.unlockedAchievementsCount;

    return ListView(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      children: [
        _buildAchievementStats(unlockedCount, totalAchievements),
        SizedBox(height: Dimensions.spacingLarge),
        if (unlockedAchievements.isNotEmpty) ...[
          Text(
            QyAppLocalizationKeys.qyUnlockedAchievements.tr(context),
            style: TextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          ...unlockedAchievements.map((achievement) =>
              _buildAchievementCard(achievement, isUnlocked: true)),
          SizedBox(height: Dimensions.spacingLarge),
        ],
        if (lockedAchievements.isNotEmpty) ...[
          Text(
            QyAppLocalizationKeys.qyLockedAchievements.tr(context),
            style: TextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          ...lockedAchievements.map((achievement) =>
              _buildAchievementCard(achievement, isUnlocked: false)),
        ],
      ],
    );
  }

  Widget _buildAchievementStats(int unlocked, int total) {
    final percentage = total > 0 ? (unlocked / total) : 0.0;

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
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$unlocked',
                style: TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  color: ThemeColors.surface,
                  height: 1.0,
                ),
              ),
              Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: Text(
                  ' / $total',
                  style: TextStyles.h3.copyWith(
                    color: ThemeColors.surface.withOpacity(0.8),
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyAchievementsUnlocked.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          ClipRRect(
            borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: percentage,
              minHeight: 8,
              backgroundColor: ThemeColors.surface.withOpacity(0.3),
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.surface),
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            '${(percentage * 100).toStringAsFixed(0)}% ${QyAppLocalizationKeys.qyComplete.tr(context)}',
            style: TextStyles.body2.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAchievementCard(AchievementModel achievement, {required bool isUnlocked}) {
    final dateFormat = DateFormat('yyyy-MM-dd');

    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: isUnlocked ? ThemeColors.surface : ThemeColors.surface.withOpacity(0.5),
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(
          color: isUnlocked ? ThemeColors.primary.withOpacity(0.3) : ThemeColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: (isUnlocked ? ThemeColors.primary : ThemeColors.textTertiary)
                  .withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isUnlocked ? Icons.emoji_events : Icons.lock,
              size: 32,
              color: isUnlocked ? ThemeColors.primary : ThemeColors.textTertiary,
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  achievement.title,
                  style: TextStyles.body1.copyWith(
                    color: isUnlocked ? ThemeColors.textPrimary : ThemeColors.textTertiary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  achievement.description,
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
                if (!isUnlocked) ...[
                  SizedBox(height: Dimensions.spacingSmall),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    child: LinearProgressIndicator(
                      value: achievement.progressPercentage,
                      minHeight: 4,
                      backgroundColor: ThemeColors.border,
                      valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    '${achievement.progress} / ${achievement.target}',
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textTertiary,
                    ),
                  ),
                ],
                if (isUnlocked && achievement.unlockedAt != null) ...[
                  SizedBox(height: Dimensions.spacingXSmall),
                  Row(
                    children: [
                      Icon(
                        Icons.check_circle,
                        size: 14,
                        color: ThemeColors.success,
                      ),
                      SizedBox(width: Dimensions.spacingXSmall),
                      Text(
                        dateFormat.format(achievement.unlockedAt!),
                        style: TextStyles.caption.copyWith(
                          color: ThemeColors.success,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(IconData icon, String title, String description) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(Dimensions.paddingLarge),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 80,
              color: ThemeColors.textTertiary.withOpacity(0.5),
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Text(
              title,
              style: TextStyles.h4.copyWith(
                color: ThemeColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: Dimensions.spacingSmall),
            Text(
              description,
              style: TextStyles.body2.copyWith(
                color: ThemeColors.textTertiary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
