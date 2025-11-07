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

class CourseLessonScreenRefactoredAppQy extends StatefulWidget {
  final String lessonId;

  const CourseLessonScreenRefactoredAppQy({
    super.key,
    required this.lessonId,
  });

  @override
  State<CourseLessonScreenRefactoredAppQy> createState() =>
      _CourseLessonScreenRefactoredAppQyState();
}

class _CourseLessonScreenRefactoredAppQyState
    extends State<CourseLessonScreenRefactoredAppQy> {
  int _currentSection = 0;
  bool _isPlaying = false;
  final List<Map<String, dynamic>> _lessonSections = [];
  String _lessonTitle = '';

  @override
  void initState() {
    super.initState();
    _initLessonData();
  }

  void _initLessonData() {
    _lessonTitle = 'Business Vocabulary Basics';

    _lessonSections.addAll([
      {
        'type': 'video',
        'title': 'Introduction',
        'duration': '5:30',
        'content': 'Video content placeholder',
      },
      {
        'type': 'text',
        'title': 'Key Vocabulary',
        'content': '''
# Essential Business Terms

## Meeting Related
- **Agenda**: A list of items to be discussed at a meeting
- **Minutes**: Official record of what was discussed and decided
- **Action Item**: A task assigned to be completed

## Communication
- **Correspondence**: Written communication, especially letters
- **Memo**: A short message or reminder
- **Follow-up**: Contact someone again after initial communication
        ''',
      },
      {
        'type': 'audio',
        'title': 'Pronunciation Practice',
        'duration': '3:15',
        'content': 'Audio content placeholder',
      },
      {
        'type': 'quiz',
        'title': 'Knowledge Check',
        'content': 'Quiz content placeholder',
        'questions': 5,
      },
      {
        'type': 'text',
        'title': 'Practice Exercises',
        'content': '''
# Practice Sentences

1. We need to prepare the ____ for tomorrow's meeting.
2. Please take ____ during the conference.
3. Don't forget to ____ with the client next week.

Try to fill in the blanks with the vocabulary you've learned.
        ''',
      },
    ]);
  }

  void _nextSection() {
    if (_currentSection < _lessonSections.length - 1) {
      setState(() {
        _currentSection++;
      });
    } else {
      _completeLesson();
    }
  }

  void _previousSection() {
    if (_currentSection > 0) {
      setState(() {
        _currentSection--;
      });
    }
  }

  void _togglePlay() {
    setState(() {
      _isPlaying = !_isPlaying;
    });
  }

  void _completeLesson() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeColors.surface,
        title: Row(
          children: [
            Icon(Icons.check_circle, color: ThemeColors.success, size: 32),
            SizedBox(width: ThemeDimensions.spacingMedium),
            Text(
              QyAppLocalizationKeys.qyLessonComplete.tr(context),
              style: ThemeTextStyles.h4.copyWith(color: ThemeColors.textPrimary),
            ),
          ],
        ),
        content: Text(
          QyAppLocalizationKeys.qyCongratulations.tr(context),
          style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: Text(
              QyAppLocalizationKeys.qyCommonOk.tr(context),
              style: ThemeTextStyles.button.copyWith(color: ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final section = _lessonSections[_currentSection];

    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          _lessonTitle,
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
            onPressed: () {},
            icon: Icon(Icons.bookmark_border, color: ThemeColors.textPrimary),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildProgressIndicator(),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              child: _buildSectionContent(section),
            ),
          ),
          _buildNavigationButtons(),
        ],
      ),
    );
  }

  Widget _buildProgressIndicator() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          bottom: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${QyAppLocalizationKeys.qySection.tr(context)} ${_currentSection + 1}/${_lessonSections.length}',
                style: ThemeTextStyles.body2.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              Text(
                _lessonSections[_currentSection]['title'] as String,
                style: ThemeTextStyles.body2.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: (_currentSection + 1) / _lessonSections.length,
              minHeight: 6,
              backgroundColor: ThemeColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionContent(Map<String, dynamic> section) {
    final type = section['type'] as String;

    switch (type) {
      case 'video':
        return _buildVideoSection(section);
      case 'audio':
        return _buildAudioSection(section);
      case 'text':
        return _buildTextSection(section);
      case 'quiz':
        return _buildQuizSection(section);
      default:
        return Container();
    }
  }

  Widget _buildVideoSection(Map<String, dynamic> section) {
    return Column(
      children: [
        Container(
          height: 200,
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          ),
          child: Center(
            child: IconButton(
              onPressed: _togglePlay,
              icon: Icon(
                _isPlaying ? Icons.pause_circle : Icons.play_circle,
                size: 64,
                color: ThemeColors.surface,
              ),
            ),
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              section['title'] as String,
              style: ThemeTextStyles.h4.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.paddingSmall,
                vertical: ThemeDimensions.paddingXSmall,
              ),
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
              ),
              child: Text(
                section['duration'] as String,
                style: ThemeTextStyles.caption.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAudioSection(Map<String, dynamic> section) {
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
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        children: [
          Icon(
            Icons.headphones,
            size: 80,
            color: ThemeColors.surface,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            section['title'] as String,
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            section['duration'] as String,
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          ElevatedButton.icon(
            onPressed: _togglePlay,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.surface,
              foregroundColor: ThemeColors.primary,
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.paddingLarge,
                vertical: ThemeDimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
              ),
            ),
            icon: Icon(_isPlaying ? Icons.pause : Icons.play_arrow),
            label: Text(
              _isPlaying
                  ? QyAppLocalizationKeys.qyPause.tr(context)
                  : QyAppLocalizationKeys.qyPlay.tr(context),
              style: ThemeTextStyles.button.copyWith(
                color: ThemeColors.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextSection(Map<String, dynamic> section) {
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
            section['title'] as String,
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            section['content'] as String,
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuizSection(Map<String, dynamic> section) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Icon(
            Icons.quiz,
            size: 80,
            color: ThemeColors.primary,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            section['title'] as String,
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            '${section['questions']} ${QyAppLocalizationKeys.qyQuestions.tr(context)}',
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primary,
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.paddingLarge * 2,
                vertical: ThemeDimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
              ),
            ),
            child: Text(
              QyAppLocalizationKeys.qyStartQuiz.tr(context),
              style: ThemeTextStyles.button.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavigationButtons() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          top: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (_currentSection > 0)
              Expanded(
                child: OutlinedButton(
                  onPressed: _previousSection,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: ThemeColors.primary),
                    padding: EdgeInsets.symmetric(
                      vertical: ThemeDimensions.paddingMedium,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                    ),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyPrevious.tr(context),
                    style: ThemeTextStyles.button.copyWith(
                      color: ThemeColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            if (_currentSection > 0) SizedBox(width: ThemeDimensions.spacingMedium),
            Expanded(
              flex: _currentSection > 0 ? 1 : 1,
              child: ElevatedButton(
                onPressed: _nextSection,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.primary,
                  padding: EdgeInsets.symmetric(
                    vertical: ThemeDimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                  ),
                ),
                child: Text(
                  _currentSection < _lessonSections.length - 1
                      ? QyAppLocalizationKeys.qyNext.tr(context)
                      : QyAppLocalizationKeys.qyComplete.tr(context),
                  style: ThemeTextStyles.button.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
