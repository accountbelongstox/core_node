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

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/custom_app_bar.dart';
import '../../../../../../common/widgets/buttons/primary_button.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';

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
    extends State<CourseLessonScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final StorageAppQy _storage = StorageAppQy.instance;
  int _currentSection = 0;
  bool _isPlaying = false;
  final List<Map<String, dynamic>> _lessonSections = [];
  String _lessonTitle = '';

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    _initLessonData();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _initLessonData() async {
    try {
      final cachedLesson = await _storage.getApp<Map<String, dynamic>>(
        '${StorageAppQy.keyUserProgress}_lesson_${widget.lessonId}',
      );
      if (cachedLesson != null) {
        _lessonTitle = cachedLesson['title'] as String? ?? QyAppLocalizationKeys.qyLessons.tr(context);
        _lessonSections.addAll((cachedLesson['sections'] as List<dynamic>?)
                ?.map((e) => e as Map<String, dynamic>)
                .toList() ??
            []);
      } else {
        _lessonTitle = QyAppLocalizationKeys.qyLessons.tr(context);
        _loadDefaultSections();
        await _storage.setApp(
          '${StorageAppQy.keyUserProgress}_lesson_${widget.lessonId}',
          {
            'title': _lessonTitle,
            'sections': _lessonSections,
          },
        );
      }
    } catch (e) {
      _loadDefaultSections();
    }
  }

  void _loadDefaultSections() {
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

  Future<void> _completeLesson() async {
    await _storage.setApp(
      '${StorageAppQy.keyUserProgress}_lesson_${widget.lessonId}_completed',
      true,
    );
    if (mounted) {
      showDialog(
        context: context,
        barrierColor: Colors.transparent,
        builder: (context) => ClipRRect(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
            child: Container(
              decoration: BoxDecoration(
                gradient: ColorsAppQy.qyFrostedGlassGradient,
              ),
              padding: const EdgeInsets.all(ThemeDimensions.spacing24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle, color: ColorsAppQy.qySuccess, size: 64),
                  const SizedBox(height: ThemeDimensions.spacing16),
                  Text(
                    QyAppLocalizationKeys.qyLessonComplete.tr(context),
                    style: ThemeTextStyles.h4.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    QyAppLocalizationKeys.qyCongratulations.tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: ThemeDimensions.spacing24),
                  PrimaryButton(
                    text: QyAppLocalizationKeys.qyCommonOk.tr(context),
                    onPressed: () {
                      Navigator.pop(context);
                      context.pop();
                    },
                    backgroundColor: ColorsAppQy.qyPrimary,
                    foregroundColor: ColorsAppQy.qyTextOnPrimary,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_lessonSections.isEmpty) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: ColorsAppQy.qyPrimary),
        ),
      );
    }
    final section = _lessonSections[_currentSection];

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                CustomAppBar(
                  title: _lessonTitle,
                  backgroundColor: Colors.transparent,
                  titleColor: ColorsAppQy.qyTextPrimary,
                  iconColor: ColorsAppQy.qyTextPrimary,
                  elevation: 0,
                  systemOverlayStyle: SystemUiOverlayStyle.dark,
                  actions: [
                    IconButton(
                      onPressed: () {},
                      icon: Icon(Icons.bookmark_border, color: ColorsAppQy.qyTextPrimary),
                    ),
                  ],
                ),
                _buildProgressIndicator(),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(ThemeDimensions.spacing16),
                    child: _buildSectionContent(section),
                  ),
                ),
                _buildNavigationButtons(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundGradient() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildProgressIndicator() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: Colors.white.withOpacity(0.2),
                width: 1,
              ),
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
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                  Text(
                    _lessonSections[_currentSection]['title'] as String,
                    style: ThemeTextStyles.body2.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ThemeDimensions.spacing12),
              ClipRRect(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                child: LinearProgressIndicator(
                  value: (_currentSection + 1) / _lessonSections.length,
                  minHeight: 6,
                  backgroundColor: Colors.white.withOpacity(0.3),
                  valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
                ),
              ),
            ],
          ),
        ),
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
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Container(
            height: 200,
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qyPrimaryGradient,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(ThemeDimensions.radiusLarge),
              ),
            ),
            child: Center(
              child: IconButton(
                onPressed: _togglePlay,
                icon: Icon(
                  _isPlaying ? Icons.pause_circle : Icons.play_circle,
                  size: 64,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(ThemeDimensions.spacing16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    section['title'] as String,
                    style: ThemeTextStyles.h4.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing12,
                    vertical: ThemeDimensions.spacing4,
                  ),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyPrimary.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                  ),
                  child: Text(
                    section['duration'] as String,
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAudioSection(Map<String, dynamic> section) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Container(
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyPrimaryGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        ),
        padding: const EdgeInsets.all(ThemeDimensions.spacing24),
        child: Column(
          children: [
            Icon(
              Icons.headphones,
              size: 80,
              color: Colors.white,
            ),
            const SizedBox(height: ThemeDimensions.spacing16),
            Text(
              section['title'] as String,
              style: ThemeTextStyles.h4.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing8),
            Text(
              section['duration'] as String,
              style: ThemeTextStyles.body2.copyWith(
                color: Colors.white.withOpacity(0.9),
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing24),
            PrimaryButton(
              text: _isPlaying
                  ? QyAppLocalizationKeys.qyPause.tr(context)
                  : QyAppLocalizationKeys.qyPlay.tr(context),
              onPressed: _togglePlay,
              backgroundColor: Colors.white,
              foregroundColor: ColorsAppQy.qyPrimary,
              icon: _isPlaying ? Icons.pause : Icons.play_arrow,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextSection(Map<String, dynamic> section) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section['title'] as String,
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Text(
            section['content'] as String,
            style: ThemeTextStyles.body1.copyWith(
              color: ColorsAppQy.qyTextSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuizSection(Map<String, dynamic> section) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Column(
        children: [
          Icon(
            Icons.quiz,
            size: 80,
            color: ColorsAppQy.qyPrimary,
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Text(
            section['title'] as String,
            style: ThemeTextStyles.h4.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing8),
          Text(
            '${section['questions']} ${QyAppLocalizationKeys.qyQuestions.tr(context)}',
            style: ThemeTextStyles.body1.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing24),
          PrimaryButton(
            text: QyAppLocalizationKeys.qyStartQuiz.tr(context),
            onPressed: () {},
            backgroundColor: ColorsAppQy.qyPrimary,
            foregroundColor: ColorsAppQy.qyTextOnPrimary,
            isFullWidth: true,
          ),
        ],
      ),
    );
  }

  Widget _buildNavigationButtons() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              top: BorderSide(
                color: Colors.white.withOpacity(0.2),
                width: 1,
              ),
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
                        side: BorderSide(color: ColorsAppQy.qyPrimary, width: 2),
                        padding: const EdgeInsets.symmetric(
                          vertical: ThemeDimensions.spacing12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                        ),
                      ),
                      child: Text(
                        QyAppLocalizationKeys.qyPrevious.tr(context),
                        style: ThemeTextStyles.button.copyWith(
                          color: ColorsAppQy.qyPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                if (_currentSection > 0) const SizedBox(width: ThemeDimensions.spacing12),
                Expanded(
                  child: PrimaryButton(
                    text: _currentSection < _lessonSections.length - 1
                        ? QyAppLocalizationKeys.qyNext.tr(context)
                        : QyAppLocalizationKeys.qyComplete.tr(context),
                    onPressed: _nextSection,
                    backgroundColor: ColorsAppQy.qyPrimary,
                    foregroundColor: ColorsAppQy.qyTextOnPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
