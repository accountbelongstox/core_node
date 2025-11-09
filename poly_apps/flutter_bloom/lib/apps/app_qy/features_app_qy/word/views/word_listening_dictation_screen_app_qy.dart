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
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/word_controller_app_qy.dart';

class WordListeningDictationScreenRefactoredAppQy extends StatefulWidget {
  const WordListeningDictationScreenRefactoredAppQy({super.key});

  @override
  State<WordListeningDictationScreenRefactoredAppQy> createState() =>
      _WordListeningDictationScreenRefactoredAppQyState();
}

class _WordListeningDictationScreenRefactoredAppQyState
    extends State<WordListeningDictationScreenRefactoredAppQy> {
  final TextEditingController _answerController = TextEditingController();
  int _currentWordIndex = 0;
  int _correctCount = 0;
  int _totalAttempts = 0;
  bool _showAnswer = false;
  bool _isCorrect = false;
  final List<String> _mockWords = [];
  final List<String> _mockPhonetics = [];
  final List<String> _mockDefinitions = [];

  @override
  void initState() {
    super.initState();
    _initMockData();
  }

  @override
  void dispose() {
    _answerController.dispose();
    super.dispose();
  }

  void _initMockData() {
    _mockWords.addAll([
      'achievement',
      'dedication',
      'perseverance',
      'opportunity',
      'extraordinary',
    ]);
    _mockPhonetics.addAll([
      '/əˈtʃiːvmənt/',
      '/ˌdedɪˈkeɪʃn/',
      '/ˌpɜːsəˈvɪrəns/',
      '/ˌɒpəˈtjuːnəti/',
      '/ɪkˈstrɔːdnri/',
    ]);
    _mockDefinitions.addAll([
      'A thing done successfully with effort, skill, or courage',
      'The quality of being committed to a task or purpose',
      'Persistence in doing something despite difficulty',
      'A time or set of circumstances that makes it possible to do something',
      'Very unusual or remarkable',
    ]);
  }

  void _playAudio() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${QyAppLocalizationKeys.qyPlaying.tr(context)} "${_mockWords[_currentWordIndex]}"'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _checkAnswer() {
    final answer = _answerController.text.trim().toLowerCase();
    final correctWord = _mockWords[_currentWordIndex].toLowerCase();

    setState(() {
      _totalAttempts++;
      _isCorrect = answer == correctWord;
      if (_isCorrect) {
        _correctCount++;
      }
      _showAnswer = true;
    });
  }

  void _nextWord() {
    if (_currentWordIndex < _mockWords.length - 1) {
      setState(() {
        _currentWordIndex++;
        _answerController.clear();
        _showAnswer = false;
        _isCorrect = false;
      });
    } else {
      _showCompletionDialog();
    }
  }

  void _showCompletionDialog() {
    final accuracy = _totalAttempts > 0
        ? ((_correctCount / _totalAttempts) * 100).toStringAsFixed(1)
        : '0';

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
                Icons.emoji_events,
                size: 80,
                color: ThemeColors.surface,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              Text(
                QyAppLocalizationKeys.qyDictationComplete.tr(context),
                style: ThemeTextStyles.h3.copyWith(
                  color: ThemeColors.surface,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingLarge),
              Container(
                padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
                decoration: BoxDecoration(
                  color: ThemeColors.surface.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                ),
                child: Column(
                  children: [
                    _buildResultRow(
                      QyAppLocalizationKeys.qyCorrect.tr(context),
                      '$_correctCount / $_totalAttempts',
                    ),
                    Divider(color: ThemeColors.surface.withOpacity(0.3)),
                    _buildResultRow(
                      QyAppLocalizationKeys.qyAccuracy.tr(context),
                      '$accuracy%',
                    ),
                  ],
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingLarge),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        setState(() {
                          _currentWordIndex = 0;
                          _correctCount = 0;
                          _totalAttempts = 0;
                          _answerController.clear();
                          _showAnswer = false;
                          _isCorrect = false;
                        });
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ThemeColors.surface,
                        foregroundColor: ThemeColors.primary,
                        padding: EdgeInsets.symmetric(
                          vertical: ThemeDimensions.paddingMedium,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                        ),
                      ),
                      child: Text(
                        QyAppLocalizationKeys.qyRetry.tr(context),
                        style: ThemeTextStyles.button.copyWith(
                          color: ThemeColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: ThemeDimensions.spacingMedium),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        Navigator.pop(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ThemeColors.surface.withOpacity(0.5),
                        foregroundColor: ThemeColors.surface,
                        padding: EdgeInsets.symmetric(
                          vertical: ThemeDimensions.paddingMedium,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                        ),
                      ),
                      child: Text(
                        QyAppLocalizationKeys.qyExit.tr(context),
                        style: ThemeTextStyles.button.copyWith(
                          color: ThemeColors.surface,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResultRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSmall),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          Text(
            value,
            style: ThemeTextStyles.h4.copyWith(
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
          QyAppLocalizationKeys.qyWordDictation.tr(context),
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
                '${_currentWordIndex + 1} / ${_mockWords.length}',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _buildProgressBar(),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
                child: Column(
                  children: [
                    _buildAudioPlayer(),
                    SizedBox(height: ThemeDimensions.spacingLarge),
                    _buildInputSection(),
                    if (_showAnswer) ...[
                      SizedBox(height: ThemeDimensions.spacingLarge),
                      _buildAnswerSection(),
                    ],
                  ],
                ),
              ),
            ),
            _buildActionButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressBar() {
    final progress = (_currentWordIndex + 1) / _mockWords.length;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingMedium,
        vertical: ThemeDimensions.paddingSmall,
      ),
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
                '${QyAppLocalizationKeys.qyCorrect.tr(context)}: $_correctCount / $_totalAttempts',
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

  Widget _buildAudioPlayer() {
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
          Icon(
            Icons.headset,
            size: 80,
            color: ThemeColors.surface,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyListenAndType.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          ElevatedButton.icon(
            onPressed: _playAudio,
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
            icon: Icon(Icons.volume_up, size: 24),
            label: Text(
              QyAppLocalizationKeys.qyPlayAudio.tr(context),
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
            QyAppLocalizationKeys.qyYourAnswer.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          TextField(
            controller: _answerController,
            enabled: !_showAnswer,
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
            decoration: InputDecoration(
              hintText: QyAppLocalizationKeys.qyTypeHere.tr(context),
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

  Widget _buildAnswerSection() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: _isCorrect
            ? ThemeColors.success.withOpacity(0.1)
            : ThemeColors.error.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(
          color: _isCorrect
              ? ThemeColors.success.withOpacity(0.5)
              : ThemeColors.error.withOpacity(0.5),
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
                size: 28,
              ),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                _isCorrect
                    ? QyAppLocalizationKeys.qyCorrectAnswer.tr(context)
                    : QyAppLocalizationKeys.qyWrongAnswer.tr(context),
                style: ThemeTextStyles.body1.copyWith(
                  color: _isCorrect ? ThemeColors.success : ThemeColors.error,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyCorrectWord.tr(context),
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingXSmall),
          Text(
            _mockWords[_currentWordIndex],
            style: ThemeTextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            _mockPhonetics[_currentWordIndex],
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            _mockDefinitions[_currentWordIndex],
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
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
        child: _showAnswer
            ? SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _nextWord,
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
                    _currentWordIndex < _mockWords.length - 1
                        ? QyAppLocalizationKeys.qyNext.tr(context)
                        : QyAppLocalizationKeys.qyFinish.tr(context),
                    style: ThemeTextStyles.button.copyWith(
                      color: ThemeColors.surface,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              )
            : SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _answerController.text.trim().isEmpty
                      ? null
                      : _checkAnswer,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ThemeColors.primary,
                    disabledBackgroundColor: ThemeColors.textTertiary,
                    padding: EdgeInsets.symmetric(
                      vertical: ThemeDimensions.paddingMedium,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                    ),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyCheck.tr(context),
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
