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
import '../controllers/social_controller_app_qy.dart';
import '../domain/model/social_model.dart';

class CheckinChallengeScreenRefactoredAppQy extends StatefulWidget {
  const CheckinChallengeScreenRefactoredAppQy({super.key});

  @override
  State<CheckinChallengeScreenRefactoredAppQy> createState() =>
      _CheckinChallengeScreenRefactoredAppQyState();
}

class _CheckinChallengeScreenRefactoredAppQyState
    extends State<CheckinChallengeScreenRefactoredAppQy> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = context.read<SocialControllerAppQy>();
      controller.loadTodayCheckIn();
      controller.loadCheckInHistory();
      controller.loadChallenges();
    });
  }

  Future<void> _handleCheckIn() async {
    final controller = context.read<SocialControllerAppQy>();
    final success = await controller.checkIn();

    if (success && mounted) {
      showDialog(
        context: context,
        builder: (context) => _buildCheckInSuccessDialog(controller.todayCheckIn!),
      );
    }
  }

  Widget _buildCheckInSuccessDialog(CheckInModel checkIn) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
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
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.check_circle,
              size: 80,
              color: ThemeColors.surface,
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Text(
              QyAppLocalizationKeys.qyCheckInSuccess.tr(context),
              style: TextStyles.h3.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Container(
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              decoration: BoxDecoration(
                color: ThemeColors.surface.withOpacity(0.2),
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              ),
              child: Column(
                children: [
                  _buildStatRow(
                    QyAppLocalizationKeys.qyConsecutiveDays.tr(context),
                    '${checkIn.consecutiveDays}',
                  ),
                  Divider(color: ThemeColors.surface.withOpacity(0.3)),
                  _buildStatRow(
                    QyAppLocalizationKeys.qyTotalCheckInDays.tr(context),
                    '${checkIn.totalDays}',
                  ),
                  if (checkIn.hasBonus) ...[
                    Divider(color: ThemeColors.surface.withOpacity(0.3)),
                    _buildStatRow(
                      QyAppLocalizationKeys.qyBonusPoints.tr(context),
                      '+${checkIn.bonusPoints}',
                    ),
                  ],
                ],
              ),
            ),
            SizedBox(height: Dimensions.spacingLarge),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.surface,
                foregroundColor: ThemeColors.primary,
                padding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingLarge,
                  vertical: Dimensions.paddingMedium,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
              ),
              child: Text(
                QyAppLocalizationKeys.qyCommonOk.tr(context),
                style: TextStyles.button.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          Text(
            value,
            style: TextStyles.h4.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyCheckInChallenge.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: Consumer<SocialControllerAppQy>(
        builder: (context, controller, child) {
          if (controller.isLoading && controller.checkInHistory.isEmpty) {
            return Center(
              child: CircularProgressIndicator(color: ThemeColors.primary),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              await controller.loadTodayCheckIn();
              await controller.loadCheckInHistory();
              await controller.loadChallenges();
            },
            color: ThemeColors.primary,
            child: ListView(
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              children: [
                _buildCheckInButton(controller),
                SizedBox(height: Dimensions.spacingLarge),
                _buildCheckInStats(controller),
                SizedBox(height: Dimensions.spacingLarge),
                _buildCheckInCalendar(controller),
                SizedBox(height: Dimensions.spacingLarge),
                _buildChallengesSection(controller),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCheckInButton(SocialControllerAppQy controller) {
    final hasCheckedIn = controller.hasCheckedInToday;

    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: hasCheckedIn
              ? [Colors.grey, Colors.grey.shade600]
              : [ThemeColors.primary, ThemeColors.primary.withOpacity(0.8)],
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          if (!hasCheckedIn)
            BoxShadow(
              color: ThemeColors.primary.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      child: Column(
        children: [
          Icon(
            hasCheckedIn ? Icons.check_circle : Icons.touch_app,
            size: 64,
            color: ThemeColors.surface,
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            hasCheckedIn
                ? QyAppLocalizationKeys.qyCheckedInToday.tr(context)
                : QyAppLocalizationKeys.qyCheckInNow.tr(context),
            style: TextStyles.h3.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (!hasCheckedIn) ...[
            SizedBox(height: Dimensions.spacingMedium),
            ElevatedButton(
              onPressed: controller.isLoading ? null : _handleCheckIn,
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.surface,
                foregroundColor: ThemeColors.primary,
                padding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingLarge * 2,
                  vertical: Dimensions.paddingMedium,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
              ),
              child: Text(
                QyAppLocalizationKeys.qyCheckIn.tr(context),
                style: TextStyles.button.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCheckInStats(SocialControllerAppQy controller) {
    final checkIn = controller.todayCheckIn;
    final consecutiveDays = checkIn?.consecutiveDays ?? 0;
    final totalDays = checkIn?.totalDays ?? 0;

    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildStatCard(
              Icons.local_fire_department,
              QyAppLocalizationKeys.qyConsecutiveDays.tr(context),
              consecutiveDays.toString(),
              Colors.orange,
            ),
          ),
          Container(
            width: 1,
            height: 60,
            color: ThemeColors.border,
          ),
          Expanded(
            child: _buildStatCard(
              Icons.calendar_today,
              QyAppLocalizationKeys.qyTotalDays.tr(context),
              totalDays.toString(),
              Colors.blue,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(IconData icon, String label, String value, Color color) {
    return Column(
      children: [
        Icon(icon, size: 32, color: color),
        SizedBox(height: Dimensions.spacingSmall),
        Text(
          value,
          style: TextStyles.h2.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: TextStyles.caption.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildCheckInCalendar(SocialControllerAppQy controller) {
    final history = controller.checkInHistory;
    final today = DateTime.now();
    final firstDayOfMonth = DateTime(today.year, today.month, 1);
    final daysInMonth = DateTime(today.year, today.month + 1, 0).day;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCheckInHistory.tr(context),
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
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: Dimensions.spacingSmall,
              mainAxisSpacing: Dimensions.spacingSmall,
            ),
            itemCount: daysInMonth,
            itemBuilder: (context, index) {
              final day = index + 1;
              final date = DateTime(today.year, today.month, day);
              final hasCheckedIn = history.any((h) =>
                  h.checkInDate.year == date.year &&
                  h.checkInDate.month == date.month &&
                  h.checkInDate.day == date.day);
              final isToday = date.year == today.year &&
                  date.month == today.month &&
                  date.day == today.day;

              return Container(
                decoration: BoxDecoration(
                  color: hasCheckedIn
                      ? ThemeColors.primary.withOpacity(0.8)
                      : isToday
                          ? ThemeColors.primary.withOpacity(0.2)
                          : ThemeColors.background,
                  borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                  border: isToday
                      ? Border.all(color: ThemeColors.primary, width: 2)
                      : null,
                ),
                child: Center(
                  child: Text(
                    day.toString(),
                    style: TextStyles.caption.copyWith(
                      color: hasCheckedIn
                          ? ThemeColors.surface
                          : ThemeColors.textPrimary,
                      fontWeight: hasCheckedIn ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildChallengesSection(SocialControllerAppQy controller) {
    final challenges = controller.activeChallenges;

    if (challenges.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyActiveChallenges.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        ...challenges.map((challenge) => _buildChallengeCard(challenge, controller)),
      ],
    );
  }

  Widget _buildChallengeCard(CheckInChallengeModel challenge, SocialControllerAppQy controller) {
    final dateFormat = DateFormat('MM-dd');

    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      padding: EdgeInsets.all(Dimensions.paddingMedium),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.emoji_events, color: ThemeColors.primary, size: 28),
              SizedBox(width: Dimensions.spacingSmall),
              Expanded(
                child: Text(
                  challenge.title,
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingSmall,
                  vertical: Dimensions.paddingXSmall,
                ),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                ),
                child: Text(
                  '+${challenge.rewardPoints}',
                  style: TextStyles.caption.copyWith(
                    color: Colors.amber.shade700,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            challenge.description,
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${challenge.currentDays} / ${challenge.targetDays} ${QyAppLocalizationKeys.qyDays.tr(context)}',
                          style: TextStyles.body2.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '${(challenge.progress * 100).toStringAsFixed(0)}%',
                          style: TextStyles.body2.copyWith(
                            color: ThemeColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: Dimensions.spacingXSmall),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                      child: LinearProgressIndicator(
                        value: challenge.progress,
                        minHeight: 8,
                        backgroundColor: ThemeColors.border,
                        valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.people, size: 16, color: ThemeColors.textTertiary),
                  SizedBox(width: Dimensions.spacingXSmall),
                  Text(
                    '${challenge.participants}',
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textTertiary,
                    ),
                  ),
                ],
              ),
              Text(
                '${dateFormat.format(challenge.startDate)} - ${dateFormat.format(challenge.endDate)}',
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.textTertiary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
