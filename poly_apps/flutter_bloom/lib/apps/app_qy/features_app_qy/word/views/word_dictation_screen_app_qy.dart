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
import '../controllers/word_controller_app_qy.dart';

class WordDictationScreenRefactoredAppQy extends StatefulWidget {
  const WordDictationScreenRefactoredAppQy({super.key});

  @override
  State<WordDictationScreenRefactoredAppQy> createState() =>
      _WordDictationScreenRefactoredAppQyState();
}

class _WordDictationScreenRefactoredAppQyState
    extends State<WordDictationScreenRefactoredAppQy> {
  int _currentSentenceIndex = 0;
  final TextEditingController _inputController = TextEditingController();
  String _userInput = '';
  bool _showResult = false;
  bool _isCorrect = false;
  int _correctCount = 0;
  final List<Map<String, dynamic>> _sentences = [];
  final List<String> _userWords = [];
  final List<bool> _wordCorrectness = [];

  @override
  void initState() {
    super.initState();
    _initSentences();
  }

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  void _initSentences() {
    _sentences.addAll([
      {
        'sentence': 'The quick brown fox jumps over the lazy dog.',
        'translation': 'Quick brown fox jumps over lazy dog.',
        'difficulty': 'Easy',
      },
      {
        'sentence': 'Knowledge is power and education is the key to success.',
        'translation': 'Knowledge is power and education is the key to success.',
        'difficulty': 'Medium',
      },
      {
        'sentence': 'Practice makes perfect, but nobody is perfect, so why practice?',
        'translation': 'Practice makes perfect, but nobody is perfect, so why practice?',
        'difficulty': 'Hard',
      },
    ]);
  }

  void _checkDictation() {
    final correctSentence = _sentences[_currentSentenceIndex]['sentence'] as String;
    final userSentence = _userInput.trim();

    final correctWords = correctSentence.toLowerCase().split(' ');
    _userWords.clear();
    _userWords.addAll(userSentence.toLowerCase().split(' '));

    _wordCorrectness.clear();
    for (int i = 0; i < _userWords.length; i++) {
      if (i < correctWords.length) {
        _wordCorrectness.add(_userWords[i] == correctWords[i]);
      } else {
        _wordCorrectness.add(false);
      }
    }

    final allCorrect = userSentence.toLowerCase() == correctSentence.toLowerCase();

    setState(() {
      _isCorrect = allCorrect;
      _showResult = true;
      if (_isCorrect) {
        _correctCount++;
      }
    });
  }

  void _nextSentence() {
    if (_currentSentenceIndex < _sentences.length - 1) {
      setState(() {
        _currentSentenceIndex++;
        _userInput = '';
        _showResult = false;
        _isCorrect = false;
        _inputController.clear();
        _userWords.clear();
        _wordCorrectness.clear();
      });
    } else {
      _showCompletionDialog();
    }
  }

  void _playAudio() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyPlayingAudio.tr(context)),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _showCompletionDialog() {
    final percentage = (_correctCount / _sentences.length * 100).toInt();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
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
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                percentage >= 80 ? Icons.celebration : Icons.hearing,
                size: 80,
                color: ThemeColors.surface,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              Text(
                percentage >= 80
                    ? QyAppLocalizationKeys.qyExcellent.tr(context)
                    : percentage >= 60
                        ? QyAppLocalizationKeys.qyGoodJob.tr(context)
                        : QyAppLocalizationKeys.qyKeepPracticing.tr(context),
                style: ThemeTextStyles.h3.copyWith(
                  color: ThemeColors.surface,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              Text(
                '${QyAppLocalizationKeys.qyYourScore.tr(context)}: $percentage%',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.surface.withOpacity(0.9),
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingLarge),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.surface,
                  foregroundColor: ThemeColors.primary,
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingLarge,
                    vertical: ThemeDimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                  ),
                ),
                child: Text(
                  QyAppLocalizationKeys.qyCommonOk.tr(context),
                  style: ThemeTextStyles.button.copyWith(
                    color: ThemeColors.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sentence = _sentences[_currentSentenceIndex];

    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyDictation.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        actions: [
          Padding(
            padding: EdgeInsets.only(right: ThemeDimensions.paddingMedium),
            child: Center(
              child: Text(
                '${_currentSentenceIndex + 1}/${_sentences.length}',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildProgressBar(),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
              child: Column(
                children: [
                  _buildAudioCard(sentence),
                  SizedBox(height: ThemeDimensions.spacingLarge),
                  _buildInputSection(),
                  if (_showResult) ...{
                    SizedBox(height: ThemeDimensions.spacingLarge),
                    _buildResultCard(sentence),
                  },
                ],
              ),
            ),
          ),
          _buildActionButtons(),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    final progress = (_currentSentenceIndex + 1) / _sentences.length;

    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${QyAppLocalizationKeys.qyProgress.tr(context)}: ${(progress * 100).toInt()}%',
                style: ThemeTextStyles.caption.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              Text(
                '${QyAppLocalizationKeys.qyCorrect.tr(context)}: $_correctCount',
                style: ThemeTextStyles.caption.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: ThemeColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAudioCard(Map<String, dynamic> sentence) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge * 2),
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
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.paddingMedium,
              vertical: ThemeDimensions.paddingSmall,
            ),
            decoration: BoxDecoration(
              color: ThemeColors.surface.withOpacity(0.2),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            ),
            child: Text(
              sentence['difficulty'] as String,
              style: ThemeTextStyles.caption.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Icon(
            Icons.hearing,
            size: 64,
            color: ThemeColors.surface,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyListenAndWrite.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: _playAudio,
                icon: Icon(
                  Icons.replay,
                  size: 28,
                  color: ThemeColors.surface.withOpacity(0.8),
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingMedium),
              ElevatedButton(
                onPressed: _playAudio,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.surface,
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingLarge * 2,
                    vertical: ThemeDimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.play_arrow, color: ThemeColors.primary, size: 28),
                    SizedBox(width: ThemeDimensions.spacingSmall),
                    Text(
                      QyAppLocalizationKeys.qyPlay.tr(context),
                      style: ThemeTextStyles.button.copyWith(
                        color: ThemeColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingMedium),
              IconButton(
                onPressed: () {},
                icon: Icon(
                  Icons.slow_motion_video,
                  size: 28,
                  color: ThemeColors.surface.withOpacity(0.8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInputSection() {
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
            QyAppLocalizationKeys.qyTypeWhatYouHear.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          TextField(
            controller: _inputController,
            enabled: !_showResult,
            onChanged: (value) => setState(() => _userInput = value),
            maxLines: 3,
            style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textPrimary),
            decoration: InputDecoration(
              hintText: QyAppLocalizationKeys.qyEnterSentence.tr(context),
              hintStyle: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textTertiary,
              ),
              filled: true,
              fillColor: ThemeColors.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                borderSide: BorderSide(color: ThemeColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                borderSide: BorderSide(color: ThemeColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                borderSide: BorderSide(color: ThemeColors.primary, width: 2),
              ),
              disabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                borderSide: BorderSide(color: ThemeColors.border),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultCard(Map<String, dynamic> sentence) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: _isCorrect
            ? ThemeColors.success.withOpacity(0.1)
            : ThemeColors.error.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(
          color: _isCorrect ? ThemeColors.success : ThemeColors.error,
          width: 2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                _isCorrect ? Icons.check_circle : Icons.cancel,
                color: _isCorrect ? ThemeColors.success : ThemeColors.error,
              ),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                _isCorrect
                    ? QyAppLocalizationKeys.qyCorrect.tr(context)
                    : QyAppLocalizationKeys.qyIncorrect.tr(context),
                style: ThemeTextStyles.h4.copyWith(
                  color: _isCorrect ? ThemeColors.success : ThemeColors.error,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          if (!_isCorrect) ...{
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              '${QyAppLocalizationKeys.qyCorrect.tr(context)}:',
              style: ThemeTextStyles.body2.copyWith(
                color: ThemeColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Text(
              sentence['sentence'] as String,
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textPrimary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              '${QyAppLocalizationKeys.qyYourAnswer.tr(context)}:',
              style: ThemeTextStyles.body2.copyWith(
                color: ThemeColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Wrap(
              spacing: ThemeDimensions.spacingXSmall,
              runSpacing: ThemeDimensions.spacingXSmall,
              children: List.generate(_userWords.length, (index) {
                final isCorrect = index < _wordCorrectness.length && _wordCorrectness[index];
                return Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingSmall,
                    vertical: ThemeDimensions.paddingXSmall,
                  ),
                  decoration: BoxDecoration(
                    color: isCorrect
                        ? ThemeColors.success.withOpacity(0.1)
                        : ThemeColors.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                  ),
                  child: Text(
                    _userWords[index],
                    style: ThemeTextStyles.body2.copyWith(
                      color: isCorrect ? ThemeColors.success : ThemeColors.error,
                      decoration: isCorrect ? null : TextDecoration.lineThrough,
                    ),
                  ),
                );
              }),
            ),
          },
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(top: BorderSide(color: ThemeColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _showResult
                ? _nextSentence
                : (_userInput.isNotEmpty ? _checkDictation : null),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primary,
              disabledBackgroundColor: ThemeColors.textTertiary,
              padding: EdgeInsets.symmetric(vertical: ThemeDimensions.paddingMedium),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
              ),
            ),
            child: Text(
              _showResult
                  ? (_currentSentenceIndex < _sentences.length - 1
                      ? QyAppLocalizationKeys.qyNext.tr(context)
                      : QyAppLocalizationKeys.qyFinish.tr(context))
                  : QyAppLocalizationKeys.qyCheck.tr(context),
              style: ThemeTextStyles.button.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
