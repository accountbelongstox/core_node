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

class CourseProgressScreenRefactoredAppQy extends StatefulWidget {
  final String courseId;

  const CourseProgressScreenRefactoredAppQy({
    super.key,
    required this.courseId,
  });

  @override
  State<CourseProgressScreenRefactoredAppQy> createState() =>
      _CourseProgressScreenRefactoredAppQyState();
}

class _CourseProgressScreenRefactoredAppQyState
    extends State<CourseProgressScreenRefactoredAppQy> {
  final List<Map<String, dynamic>> _chapters = [];
  double _overallProgress = 0.0;
  int _completedLessons = 0;
  int _totalLessons = 0;
  String _courseName = '';

  @override
  void initState() {
    super.initState();
    _initCourseProgress();
  }

  void _initCourseProgress() {
    _courseName = 'Business English Communication';
    _overallProgress = 0.65;
    _completedLessons = 13;
    _totalLessons = 20;

    _chapters.addAll([
      {
        'title': 'Introduction to Business',
        'lessons': [
          {'title': 'Business Vocabulary Basics', 'completed': true, 'score': 95},
          {'title': 'Common Business Phrases', 'completed': true, 'score': 88},
          {'title': 'Professional Greetings', 'completed': true, 'score': 92},
        ],
        'progress': 1.0,
      },
      {
        'title': 'Email Writing',
        'lessons': [
          {'title': 'Formal Email Structure', 'completed': true, 'score': 90},
          {'title': 'Writing Subject Lines', 'completed': true, 'score': 85},
          {'title': 'Professional Closings', 'completed': true, 'score': 94},
          {'title': 'Email Etiquette', 'completed': true, 'score': 91},
        ],
        'progress': 1.0,
      },
      {
        'title': 'Meetings and Presentations',
        'lessons': [
          {'title': 'Meeting Vocabulary', 'completed': true, 'score': 87},
          {'title': 'Giving Presentations', 'completed': true, 'score': 89},
          {'title': 'Asking Questions', 'completed': true, 'score': 93},
          {'title': 'Making Suggestions', 'completed': true, 'score': 86},
          {'title': 'Handling Q&A Sessions', 'completed': false, 'score': 0},
        ],
        'progress': 0.8,
      },
      {
        'title': 'Negotiations',
        'lessons': [
          {'title': 'Negotiation Basics', 'completed': true, 'score': 88},
          {'title': 'Making Offers', 'completed': true, 'score': 90},
          {'title': 'Compromise Phrases', 'completed': false, 'score': 0},
          {'title': 'Closing Deals', 'completed': false, 'score': 0},
        ],
        'progress': 0.5,
      },
      {
        'title': 'Telephone Communication',
        'lessons': [
          {'title': 'Phone Etiquette', 'completed': false, 'score': 0},
          {'title': 'Taking Messages', 'completed': false, 'score': 0},
          {'title': 'Conference Calls', 'completed': false, 'score': 0},
        ],
        'progress': 0.0,
      },
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyCourseProgress.tr(context),
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
          _buildOverviewCard(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildProgressStats(),
          SizedBox(height: Dimensions.spacingLarge),
          _buildChaptersList(),
        ],
      ),
    );
  }

  Widget _buildOverviewCard() {
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _courseName,
            style: TextStyles.h3.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            '${QyAppLocalizationKeys.qyOverallProgress.tr(context)}: ${(_overallProgress * 100).toInt()}%',
            style: TextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          ClipRRect(
            borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
            child: LinearProgressIndicator(
              value: _overallProgress,
              minHeight: 12,
              backgroundColor: ThemeColors.surface.withOpacity(0.3),
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.surface),
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            '$_completedLessons / $_totalLessons ${QyAppLocalizationKeys.qyLessonsCompleted.tr(context)}',
            style: TextStyles.body2.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressStats() {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            Icons.check_circle,
            QyAppLocalizationKeys.qyCompleted.tr(context),
            _completedLessons.toString(),
            ThemeColors.success,
          ),
        ),
        SizedBox(width: Dimensions.spacingMedium),
        Expanded(
          child: _buildStatCard(
            Icons.pending,
            QyAppLocalizationKeys.qyRemaining.tr(context),
            (_totalLessons - _completedLessons).toString(),
            Colors.orange,
          ),
        ),
        SizedBox(width: Dimensions.spacingMedium),
        Expanded(
          child: _buildStatCard(
            Icons.star,
            QyAppLocalizationKeys.qyAvgScore.tr(context),
            '89%',
            ThemeColors.primary,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(IconData icon, String label, String value, Color color) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 28),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            value,
            style: TextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingXSmall),
          Text(
            label,
            style: TextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildChaptersList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyChapters.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        ...List.generate(
          _chapters.length,
          (index) => Padding(
            padding: EdgeInsets.only(bottom: Dimensions.spacingMedium),
            child: _buildChapterCard(index),
          ),
        ),
      ],
    );
  }

  Widget _buildChapterCard(int index) {
    final chapter = _chapters[index];
    final lessons = chapter['lessons'] as List<Map<String, dynamic>>;
    final progress = chapter['progress'] as double;

    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {},
            child: Padding(
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: ThemeColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    ),
                    child: Center(
                      child: Text(
                        '${index + 1}',
                        style: TextStyles.h4.copyWith(
                          color: ThemeColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: Dimensions.spacingMedium),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          chapter['title'] as String,
                          style: TextStyles.body1.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(height: Dimensions.spacingXSmall),
                        Text(
                          '${lessons.length} ${QyAppLocalizationKeys.qyLessons.tr(context)}',
                          style: TextStyles.caption.copyWith(
                            color: ThemeColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: Dimensions.paddingSmall,
                      vertical: Dimensions.paddingXSmall,
                    ),
                    decoration: BoxDecoration(
                      color: progress == 1.0
                          ? ThemeColors.success.withOpacity(0.1)
                          : ThemeColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    ),
                    child: Text(
                      '${(progress * 100).toInt()}%',
                      style: TextStyles.caption.copyWith(
                        color: progress == 1.0 ? ThemeColors.success : ThemeColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: Dimensions.paddingMedium),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 4,
                backgroundColor: ThemeColors.border,
                valueColor: AlwaysStoppedAnimation<Color>(
                  progress == 1.0 ? ThemeColors.success : ThemeColors.primary,
                ),
              ),
            ),
          ),
          ...List.generate(
            lessons.length,
            (lessonIndex) => _buildLessonItem(lessons[lessonIndex]),
          ),
        ],
      ),
    );
  }

  Widget _buildLessonItem(Map<String, dynamic> lesson) {
    final completed = lesson['completed'] as bool;
    final score = lesson['score'] as int;

    return Container(
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: InkWell(
        onTap: () {},
        child: Padding(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          child: Row(
            children: [
              Icon(
                completed ? Icons.check_circle : Icons.radio_button_unchecked,
                color: completed ? ThemeColors.success : ThemeColors.textTertiary,
                size: 24,
              ),
              SizedBox(width: Dimensions.spacingMedium),
              Expanded(
                child: Text(
                  lesson['title'] as String,
                  style: TextStyles.body2.copyWith(
                    color: completed ? ThemeColors.textPrimary : ThemeColors.textSecondary,
                    decoration: completed ? TextDecoration.none : null,
                  ),
                ),
              ),
              if (completed)
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: Dimensions.paddingSmall,
                    vertical: Dimensions.paddingXSmall,
                  ),
                  decoration: BoxDecoration(
                    color: ThemeColors.success.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.star, size: 12, color: ThemeColors.success),
                      SizedBox(width: Dimensions.spacingXSmall),
                      Text(
                        '$score',
                        style: TextStyles.caption.copyWith(
                          color: ThemeColors.success,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
