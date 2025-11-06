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
            SizedBox(width: Dimensions.spacingMedium),
            Text(
              QyAppLocalizationKeys.qyLessonComplete.tr(context),
              style: TextStyles.h4.copyWith(color: ThemeColors.textPrimary),
            ),
          ],
        ),
        content: Text(
          QyAppLocalizationKeys.qyCongratulations.tr(context),
          style: TextStyles.body1.copyWith(color: ThemeColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: Text(
              QyAppLocalizationKeys.qyCommonOk.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.primary),
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
              padding: EdgeInsets.all(Dimensions.paddingMedium),
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
      padding: EdgeInsets.all(Dimensions.paddingMedium),
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
                style: TextStyles.body2.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              Text(
                _lessonSections[_currentSection]['title'] as String,
                style: TextStyles.body2.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingSmall),
          ClipRRect(
            borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
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
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
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
        SizedBox(height: Dimensions.spacingMedium),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              section['title'] as String,
              style: TextStyles.h4.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: Dimensions.paddingSmall,
                vertical: Dimensions.paddingXSmall,
              ),
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
              ),
              child: Text(
                section['duration'] as String,
                style: TextStyles.caption.copyWith(
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
        children: [
          Icon(
            Icons.headphones,
            size: 80,
            color: ThemeColors.surface,
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            section['title'] as String,
            style: TextStyles.h4.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            section['duration'] as String,
            style: TextStyles.body2.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          ElevatedButton.icon(
            onPressed: _togglePlay,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.surface,
              foregroundColor: ThemeColors.primary,
              padding: EdgeInsets.symmetric(
                horizontal: Dimensions.paddingLarge,
                vertical: Dimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
              ),
            ),
            icon: Icon(_isPlaying ? Icons.pause : Icons.play_arrow),
            label: Text(
              _isPlaying
                  ? QyAppLocalizationKeys.qyPause.tr(context)
                  : QyAppLocalizationKeys.qyPlay.tr(context),
              style: TextStyles.button.copyWith(
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
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section['title'] as String,
            style: TextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            section['content'] as String,
            style: TextStyles.body1.copyWith(
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
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Icon(
            Icons.quiz,
            size: 80,
            color: ThemeColors.primary,
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            section['title'] as String,
            style: TextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            '${section['questions']} ${QyAppLocalizationKeys.qyQuestions.tr(context)}',
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primary,
              padding: EdgeInsets.symmetric(
                horizontal: Dimensions.paddingLarge * 2,
                vertical: Dimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              ),
            ),
            child: Text(
              QyAppLocalizationKeys.qyStartQuiz.tr(context),
              style: TextStyles.button.copyWith(
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
      padding: EdgeInsets.all(Dimensions.paddingMedium),
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
                      vertical: Dimensions.paddingMedium,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                    ),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyPrevious.tr(context),
                    style: TextStyles.button.copyWith(
                      color: ThemeColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            if (_currentSection > 0) SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              flex: _currentSection > 0 ? 1 : 1,
              child: ElevatedButton(
                onPressed: _nextSection,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.primary,
                  padding: EdgeInsets.symmetric(
                    vertical: Dimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  ),
                ),
                child: Text(
                  _currentSection < _lessonSections.length - 1
                      ? QyAppLocalizationKeys.qyNext.tr(context)
                      : QyAppLocalizationKeys.qyComplete.tr(context),
                  style: TextStyles.button.copyWith(
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
