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
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../router_app_qy/routes_provider_app_qy.dart';

class HomeStreakScreenRefactoredAppQy extends StatefulWidget {
  const HomeStreakScreenRefactoredAppQy({super.key});

  @override
  State<HomeStreakScreenRefactoredAppQy> createState() =>
      _HomeStreakScreenRefactoredAppQyState();
}

class _HomeStreakScreenRefactoredAppQyState
    extends State<HomeStreakScreenRefactoredAppQy> {
  int _currentStreak = 0;
  int _longestStreak = 0;
  int _totalDays = 0;
  final Map<String, bool> _streakCalendar = {};

  @override
  void initState() {
    super.initState();
    _initStreakData();
  }

  void _initStreakData() {
    _currentStreak = 15;
    _longestStreak = 32;
    _totalDays = 87;

    final now = DateTime.now();
    for (int i = 0; i < 30; i++) {
      final date = now.subtract(Duration(days: i));
      final key = DateFormat('yyyy-MM-dd').format(date);
      _streakCalendar[key] = i < 15;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyStreak.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else {
              context.go(QyAppRoutesProvider.routeHome);
            }
          },
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        child: Column(
          children: [
            _buildStreakCard(),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildStatsCards(),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildCalendar(),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildStreakTips(),
          ],
        ),
      ),
    );
  }

  Widget _buildStreakCard() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge * 2),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ColorsAppQy.qyWarning,
            ColorsAppQy.qyWarning,
          ],
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyWarning.withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(
            Icons.local_fire_department,
            size: 80,
            color: ColorsAppQy.qyTextOnPrimary,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyCurrentStreak.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ColorsAppQy.qyFrostWhite,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$_currentStreak',
                style: TextStyle(
                  fontSize: 64,
                  fontWeight: FontWeight.bold,
                  color: ColorsAppQy.qyTextOnPrimary,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  QyAppLocalizationKeys.qyDays.tr(context),
                  style: ThemeTextStyles.h4.copyWith(
                    color: ColorsAppQy.qyFrostWhite,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyKeepItUp.tr(context),
            style: ThemeTextStyles.body2.copyWith(
              color: ColorsAppQy.qyFrostWhite,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsCards() {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            Icons.military_tech,
            QyAppLocalizationKeys.qyLongestStreak.tr(context),
            '$_longestStreak ${QyAppLocalizationKeys.qyDays.tr(context)}',
            Colors.purple,
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingMedium),
        Expanded(
          child: _buildStatCard(
            Icons.calendar_today,
            QyAppLocalizationKeys.qyTotalDays.tr(context),
            '$_totalDays ${QyAppLocalizationKeys.qyDays.tr(context)}',
            ColorsAppQy.qyInfo,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(
      IconData icon, String label, String value, Color color) {
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
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingXSmall),
          Text(
            label,
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
          ),
        ],
      ),
    );
  }

  Widget _buildCalendar() {
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
            QyAppLocalizationKeys.qyActivityCalendar.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildCalendarGrid(),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildCalendarLegend(),
        ],
      ),
    );
  }

  Widget _buildCalendarGrid() {
    final now = DateTime.now();
    final weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: weekdays.map((day) {
            return SizedBox(
              width: 36,
              child: Text(
                day,
                style: ThemeTextStyles.caption.copyWith(
                  color: ThemeColors.textTertiary,
                ),
                textAlign: TextAlign.center,
              ),
            );
          }).toList(),
        ),
        SizedBox(height: ThemeDimensions.spacingSmall),
        ...List.generate(4, (weekIndex) {
          return Padding(
            padding: EdgeInsets.only(bottom: ThemeDimensions.spacingSmall),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(7, (dayIndex) {
                final daysAgo = (3 - weekIndex) * 7 + (6 - dayIndex);
                final date = now.subtract(Duration(days: daysAgo));
                final key = DateFormat('yyyy-MM-dd').format(date);
                final isActive = _streakCalendar[key] ?? false;

                return Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: isActive
                        ? ColorsAppQy.qyWarning.withOpacity(0.8)
                        : ThemeColors.background,
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusSmall),
                    border: Border.all(
                      color: isActive ? ColorsAppQy.qyWarning : ThemeColors.border,
                    ),
                  ),
                  child: Center(
                    child: isActive
                        ? Icon(
                            Icons.local_fire_department,
                            size: 16,
                            color: ColorsAppQy.qyTextOnPrimary,
                          )
                        : null,
                  ),
                );
              }),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildCalendarLegend() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: ColorsAppQy.qyWarning.withOpacity(0.8),
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingSmall),
        Text(
          QyAppLocalizationKeys.qyStudied.tr(context),
          style: ThemeTextStyles.caption.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingMedium),
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: ThemeColors.background,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            border: Border.all(color: ThemeColors.border),
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingSmall),
        Text(
          QyAppLocalizationKeys.qyNoActivity.tr(context),
          style: ThemeTextStyles.caption.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildStreakTips() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.primary.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.lightbulb, color: ThemeColors.primary, size: 24),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                QyAppLocalizationKeys.qyStreakTips.tr(context),
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildTipItem(QyAppLocalizationKeys.qyTip1.tr(context)),
          SizedBox(height: ThemeDimensions.spacingSmall),
          _buildTipItem(QyAppLocalizationKeys.qyTip2.tr(context)),
          SizedBox(height: ThemeDimensions.spacingSmall),
          _buildTipItem(QyAppLocalizationKeys.qyTip3.tr(context)),
        ],
      ),
    );
  }

  Widget _buildTipItem(String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: EdgeInsets.only(top: 6),
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: ThemeColors.primary,
            shape: BoxShape.circle,
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingSmall),
        Expanded(
          child: Text(
            text,
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}
