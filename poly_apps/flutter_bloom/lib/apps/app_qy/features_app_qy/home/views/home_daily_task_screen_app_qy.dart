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
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../router_app_qy/routes_provider_app_qy.dart';

class HomeDailyTaskScreenRefactoredAppQy extends StatefulWidget {
  const HomeDailyTaskScreenRefactoredAppQy({super.key});

  @override
  State<HomeDailyTaskScreenRefactoredAppQy> createState() =>
      _HomeDailyTaskScreenRefactoredAppQyState();
}

class _HomeDailyTaskScreenRefactoredAppQyState
    extends State<HomeDailyTaskScreenRefactoredAppQy> {
  final List<Map<String, dynamic>> _tasks = [];
  int _totalPoints = 0;
  int _earnedPoints = 0;
  int _completedTasks = 0;

  @override
  void initState() {
    super.initState();
    _initTasks();
  }

  void _initTasks() {
    _totalPoints = 150;
    _earnedPoints = 60;
    _completedTasks = 3;

    _tasks.addAll([
      {
        'id': 't1',
        'title': 'Learn 20 new words',
        'description': 'Complete your daily word learning goal',
        'points': 30,
        'progress': 15,
        'total': 20,
        'completed': false,
        'icon': Icons.book,
        'color': ColorsAppQy.qyInfo,
      },
      {
        'id': 't2',
        'title': 'Complete a lesson',
        'description': 'Finish one course lesson',
        'points': 50,
        'progress': 1,
        'total': 1,
        'completed': true,
        'icon': Icons.school,
        'color': ColorsAppQy.qySuccess,
      },
      {
        'id': 't3',
        'title': 'Practice pronunciation',
        'description': 'Practice 10 words pronunciation',
        'points': 20,
        'progress': 10,
        'total': 10,
        'completed': true,
        'icon': Icons.record_voice_over,
        'color': Colors.purple,
      },
      {
        'id': 't4',
        'title': 'Take a quiz',
        'description': 'Complete one vocabulary quiz',
        'points': 40,
        'progress': 0,
        'total': 1,
        'completed': false,
        'icon': Icons.quiz,
        'color': ColorsAppQy.qyWarning,
      },
      {
        'id': 't5',
        'title': 'Study for 30 minutes',
        'description': 'Maintain your learning streak',
        'points': 10,
        'progress': 30,
        'total': 30,
        'completed': true,
        'icon': Icons.timer,
        'color': Colors.teal,
      },
    ]);
  }

  void _completeTask(Map<String, dynamic> task) {
    if (task['completed'] as bool) return;

    setState(() {
      task['completed'] = true;
      task['progress'] = task['total'];
      _earnedPoints += task['points'] as int;
      _completedTasks++;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyTaskCompleted.tr(context)}! +${task['points']} ${QyAppLocalizationKeys.qyPoints.tr(context)}',
        ),
        backgroundColor: ThemeColors.success,
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
          QyAppLocalizationKeys.qyDailyTasks.tr(context),
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
      body: Column(
        children: [
          _buildProgressHeader(),
          Expanded(
            child: _buildTasksList(),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressHeader() {
    final progress = _earnedPoints / _totalPoints;

    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary,
            ThemeColors.primary.withOpacity(0.8),
          ],
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    QyAppLocalizationKeys.qyTodayProgress.tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ThemeColors.surface.withOpacity(0.9),
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacingSmall),
                  Row(
                    children: [
                      Icon(Icons.star, color: ThemeColors.surface, size: 28),
                      SizedBox(width: ThemeDimensions.spacingSmall),
                      Text(
                        '$_earnedPoints / $_totalPoints',
                        style: ThemeTextStyles.h2.copyWith(
                          color: ThemeColors.surface,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
                decoration: BoxDecoration(
                  color: ThemeColors.surface.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Column(
                  children: [
                    Text(
                      '$_completedTasks',
                      style: ThemeTextStyles.h2.copyWith(
                        color: ThemeColors.surface,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      '/${_tasks.length}',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ThemeColors.surface.withOpacity(0.9),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 12,
              backgroundColor: ThemeColors.surface.withOpacity(0.3),
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.surface),
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            '${(progress * 100).toInt()}% ${QyAppLocalizationKeys.qyComplete.tr(context)}',
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTasksList() {
    return ListView.builder(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      itemCount: _tasks.length,
      itemBuilder: (context, index) {
        return Padding(
          padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
          child: _buildTaskCard(_tasks[index]),
        );
      },
    );
  }

  Widget _buildTaskCard(Map<String, dynamic> task) {
    final completed = task['completed'] as bool;
    final progress = task['progress'] as int;
    final total = task['total'] as int;
    final color = task['color'] as Color;

    return InkWell(
      onTap: () => _completeTask(task),
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          border: Border.all(
            color: completed ? color.withOpacity(0.5) : ThemeColors.border,
            width: completed ? 2 : 1,
          ),
          boxShadow: completed
              ? [
                  BoxShadow(
                    color: color.withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusMedium),
                  ),
                  child: Icon(
                    task['icon'] as IconData,
                    color: color,
                    size: 28,
                  ),
                ),
                SizedBox(width: ThemeDimensions.spacingMedium),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task['title'] as String,
                        style: ThemeTextStyles.body1.copyWith(
                          color: ThemeColors.textPrimary,
                          fontWeight: FontWeight.w600,
                          decoration:
                              completed ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacingXSmall),
                      Text(
                        task['description'] as String,
                        style: ThemeTextStyles.caption.copyWith(
                          color: ThemeColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                if (completed)
                  Icon(
                    Icons.check_circle,
                    color: color,
                    size: 32,
                  )
                else
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.paddingSmall,
                      vertical: ThemeDimensions.paddingXSmall,
                    ),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.1),
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.radiusSmall),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.star, size: 14, color: color),
                        SizedBox(width: ThemeDimensions.spacingXSmall),
                        Text(
                          '+${task['points']}',
                          style: ThemeTextStyles.caption.copyWith(
                            color: color,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            if (!completed) ...{
              SizedBox(height: ThemeDimensions.spacingMedium),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyProgress.tr(context),
                        style: ThemeTextStyles.caption.copyWith(
                          color: ThemeColors.textSecondary,
                        ),
                      ),
                      Text(
                        '$progress / $total',
                        style: ThemeTextStyles.caption.copyWith(
                          color: color,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.spacingSmall),
                  ClipRRect(
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusSmall),
                    child: LinearProgressIndicator(
                      value: progress / total,
                      minHeight: 6,
                      backgroundColor: ThemeColors.border,
                      valueColor: AlwaysStoppedAnimation<Color>(color),
                    ),
                  ),
                ],
              ),
            },
          ],
        ),
      ),
    );
  }
}
