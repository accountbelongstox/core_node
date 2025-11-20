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

class ProfileStatsScreenRefactoredAppQy extends StatefulWidget {
  const ProfileStatsScreenRefactoredAppQy({super.key});

  @override
  State<ProfileStatsScreenRefactoredAppQy> createState() =>
      _ProfileStatsScreenRefactoredAppQyState();
}

class _ProfileStatsScreenRefactoredAppQyState
    extends State<ProfileStatsScreenRefactoredAppQy> {
  String _selectedPeriod = 'week';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProfileControllerAppQy>().loadStats();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyLearningStats.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: Consumer<ProfileControllerAppQy>(
        builder: (context, controller, child) {
          if (controller.isLoading && controller.stats.isEmpty) {
            return Center(
              child: CircularProgressIndicator(color: ThemeColors.primary),
            );
          }

          return RefreshIndicator(
            onRefresh: controller.loadStats,
            color: ThemeColors.primary,
            child: ListView(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              children: [
                _buildPeriodSelector(),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildOverviewCards(controller),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildProgressChart(),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildDetailedStats(controller),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildStreakCard(controller),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildPeriodSelector() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingXSmall),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        children: [
          _buildPeriodButton('week', QyAppLocalizationKeys.qyWeek.tr(context)),
          _buildPeriodButton('month', QyAppLocalizationKeys.qyMonth.tr(context)),
          _buildPeriodButton('year', QyAppLocalizationKeys.qyYear.tr(context)),
          _buildPeriodButton('all', QyAppLocalizationKeys.qyAllTime.tr(context)),
        ],
      ),
    );
  }

  Widget _buildPeriodButton(String period, String label) {
    final isSelected = _selectedPeriod == period;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedPeriod = period),
        child: Container(
          padding: EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSmall),
          decoration: BoxDecoration(
            color: isSelected ? ThemeColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: ThemeTextStyles.body2.copyWith(
              color: isSelected ? ThemeColors.surface : ThemeColors.textSecondary,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOverviewCards(ProfileControllerAppQy controller) {
    final stats = controller.stats;
    final totalWords = stats['total_words'] ?? 0;
    final learnedWords = stats['learned_words'] ?? 0;
    final studyDays = stats['study_days'] ?? 0;
    final studyTime = stats['total_study_time'] ?? 0;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                Icons.library_books,
                QyAppLocalizationKeys.qyTotalWords.tr(context),
                totalWords.toString(),
                Colors.blue,
              ),
            ),
            SizedBox(width: ThemeDimensions.spacingMedium),
            Expanded(
              child: _buildStatCard(
                Icons.check_circle,
                QyAppLocalizationKeys.qyLearned.tr(context),
                learnedWords.toString(),
                Colors.green,
              ),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                Icons.calendar_today,
                QyAppLocalizationKeys.qyStudyDays.tr(context),
                studyDays.toString(),
                Colors.orange,
              ),
            ),
            SizedBox(width: ThemeDimensions.spacingMedium),
            Expanded(
              child: _buildStatCard(
                Icons.access_time,
                QyAppLocalizationKeys.qyStudyTime.tr(context),
                '${(studyTime / 60).toStringAsFixed(0)}h',
                Colors.purple,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatCard(IconData icon, String label, String value, Color color) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Container(
            padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            value,
            style: ThemeTextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingXSmall),
          Text(
            label,
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildProgressChart() {
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final values = [15, 23, 18, 27, 20, 12, 25];
    final maxValue = values.reduce((a, b) => a > b ? a : b);

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
          Text(
            QyAppLocalizationKeys.qyWeeklyProgress.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          SizedBox(
            height: 150,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(
                days.length,
                (index) => Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.paddingXSmall,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          values[index].toString(),
                          style: ThemeTextStyles.caption.copyWith(
                            color: ThemeColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(height: ThemeDimensions.spacingXSmall),
                        Container(
                          height: (values[index] / maxValue) * 100,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                              colors: [
                                ThemeColors.primary,
                                ThemeColors.primary.withOpacity(0.6),
                              ],
                            ),
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(ThemeDimensions.radiusSmall),
                            ),
                          ),
                        ),
                        SizedBox(height: ThemeDimensions.spacingSmall),
                        Text(
                          days[index],
                          style: ThemeTextStyles.caption.copyWith(
                            color: ThemeColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailedStats(ProfileControllerAppQy controller) {
    final stats = controller.stats;
    final avgDailyWords = stats['average_daily_words'] ?? 0;
    final totalReviews = stats['total_review_count'] ?? 0;

    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
            child: Text(
              QyAppLocalizationKeys.qyDetailedStats.tr(context),
              style: ThemeTextStyles.h4.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildStatRow(
            Icons.trending_up,
            QyAppLocalizationKeys.qyAvgDailyWords.tr(context),
            avgDailyWords.toString(),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildStatRow(
            Icons.repeat,
            QyAppLocalizationKeys.qyTotalReviews.tr(context),
            totalReviews.toString(),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildStatRow(
            Icons.timer,
            QyAppLocalizationKeys.qyAvgSessionTime.tr(context),
            '25 min',
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildStatRow(
            Icons.percent,
            QyAppLocalizationKeys.qyAccuracyRate.tr(context),
            '87%',
          ),
        ],
      ),
    );
  }

  Widget _buildStatRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      child: Row(
        children: [
          Icon(icon, size: 20, color: ThemeColors.primary),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Text(
              label,
              style: ThemeTextStyles.body2.copyWith(
                color: ThemeColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStreakCard(ProfileControllerAppQy controller) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.orange,
            Colors.orange.shade700,
          ],
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: Colors.orange.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(
            Icons.local_fire_department,
            size: 64,
            color: Colors.white,
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qyCurrentStreak.tr(context),
                  style: ThemeTextStyles.body1.copyWith(
                    color: Colors.white.withOpacity(0.9),
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Text(
                  '15 ${QyAppLocalizationKeys.qyDays.tr(context)}',
                  style: ThemeTextStyles.h2.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyKeepItUp.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
