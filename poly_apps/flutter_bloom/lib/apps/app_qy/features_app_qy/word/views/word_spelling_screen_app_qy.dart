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

class WordSpellingScreenRefactoredAppQy extends StatefulWidget {
  const WordSpellingScreenRefactoredAppQy({super.key});

  @override
  State<WordSpellingScreenRefactoredAppQy> createState() =>
      _WordSpellingScreenRefactoredAppQyState();
}

class _WordSpellingScreenRefactoredAppQyState
    extends State<WordSpellingScreenRefactoredAppQy> {
  int _currentWordIndex = 0;
  List<String> _selectedLetters = [];
  List<String> _availableLetters = [];
  bool _showResult = false;
  bool _isCorrect = false;
  int _correctCount = 0;
  final List<Map<String, dynamic>> _spellingWords = [];

  @override
  void initState() {
    super.initState();
    _initSpellingWords();
    _setupLetters();
  }

  void _initSpellingWords() {
    _spellingWords.addAll([
      {
        'word': 'knowledge',
        'definition': 'Information and skills acquired through experience or education',
        'phonetic': '/ˈnɒlɪdʒ/',
      },
      {
        'word': 'beautiful',
        'definition': 'Pleasing to the senses or mind',
        'phonetic': '/ˈbjuːtɪfl/',
      },
      {
        'word': 'necessary',
        'definition': 'Required to be done; essential',
        'phonetic': '/ˈnesəsəri/',
      },
      {
        'word': 'opportunity',
        'definition': 'A favorable time or occasion',
        'phonetic': '/ˌɒpəˈtjuːnəti/',
      },
      {
        'word': 'experience',
        'definition': 'Practical contact with and observation of facts or events',
        'phonetic': '/ɪkˈspɪəriəns/',
      },
    ]);
  }

  void _setupLetters() {
    final word = _spellingWords[_currentWordIndex]['word'] as String;
    final letters = word.split('');
    final extraLetters = ['a', 'e', 'i', 'o', 'u', 'r', 's', 't'];

    _availableLetters = [...letters, ...extraLetters.take(4)]..shuffle();
    _selectedLetters = [];
  }

  void _selectLetter(String letter, int index) {
    if (!_showResult) {
      setState(() {
        _selectedLetters.add(letter);
        _availableLetters.removeAt(index);
      });
    }
  }

  void _removeLetter(int index) {
    if (!_showResult) {
      setState(() {
        final letter = _selectedLetters[index];
        _selectedLetters.removeAt(index);
        _availableLetters.add(letter);
      });
    }
  }

  void _checkSpelling() {
    final correctWord = _spellingWords[_currentWordIndex]['word'] as String;
    final userWord = _selectedLetters.join('');

    setState(() {
      _isCorrect = userWord.toLowerCase() == correctWord.toLowerCase();
      _showResult = true;
      if (_isCorrect) {
        _correctCount++;
      }
    });
  }

  void _nextWord() {
    if (_currentWordIndex < _spellingWords.length - 1) {
      setState(() {
        _currentWordIndex++;
        _showResult = false;
        _isCorrect = false;
        _setupLetters();
      });
    } else {
      _showCompletionDialog();
    }
  }

  void _showHint() {
    if (!_showResult && _selectedLetters.isEmpty) {
      final word = _spellingWords[_currentWordIndex]['word'] as String;
      setState(() {
        _selectedLetters.add(word[0]);
        _availableLetters.remove(word[0]);
      });
    }
  }

  void _showCompletionDialog() {
    final percentage = (_correctCount / _spellingWords.length * 100).toInt();

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
                percentage >= 80 ? Icons.celebration : Icons.edit,
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
    final word = _spellingWords[_currentWordIndex];

    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySpellingPractice.tr(context),
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
                '${_currentWordIndex + 1}/${_spellingWords.length}',
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
                  _buildDefinitionCard(word),
                  SizedBox(height: ThemeDimensions.spacingLarge),
                  _buildAnswerArea(),
                  if (_showResult) ...{
                    SizedBox(height: ThemeDimensions.spacingLarge),
                    _buildResultCard(word),
                  },
                  SizedBox(height: ThemeDimensions.spacingLarge),
                  _buildLetterGrid(),
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
    final progress = (_currentWordIndex + 1) / _spellingWords.length;

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

  Widget _buildDefinitionCard(Map<String, dynamic> word) {
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
            Icons.book,
            size: 48,
            color: ThemeColors.surface,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qySpellTheWord.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            word['definition'] as String,
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          IconButton(
            onPressed: () {},
            icon: Icon(
              Icons.volume_up,
              size: 32,
              color: ThemeColors.surface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnswerArea() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(
          color: _showResult
              ? (_isCorrect ? ThemeColors.success : ThemeColors.error)
              : ThemeColors.border,
          width: 2,
        ),
      ),
      child: Column(
        children: [
          Text(
            QyAppLocalizationKeys.qyYourAnswer.tr(context),
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          MinimumHeight(
            height: 60,
            child: Wrap(
              spacing: ThemeDimensions.spacingSmall,
              runSpacing: ThemeDimensions.spacingSmall,
              alignment: WrapAlignment.center,
              children: _selectedLetters.isEmpty
                  ? [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: ThemeColors.background,
                          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                          border: Border.all(
                            color: ThemeColors.border,
                            style: BorderStyle.solid,
                          ),
                        ),
                      ),
                    ]
                  : List.generate(
                      _selectedLetters.length,
                      (index) => InkWell(
                        onTap: () => _removeLetter(index),
                        child: Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                            color: ThemeColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                            border: Border.all(color: ThemeColors.primary),
                          ),
                          child: Center(
                            child: Text(
                              _selectedLetters[index].toUpperCase(),
                              style: ThemeTextStyles.h4.copyWith(
                                color: ThemeColors.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
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

  Widget _buildResultCard(Map<String, dynamic> word) {
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
      child: Row(
        children: [
          Icon(
            _isCorrect ? Icons.check_circle : Icons.cancel,
            color: _isCorrect ? ThemeColors.success : ThemeColors.error,
            size: 32,
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _isCorrect
                      ? QyAppLocalizationKeys.qyCorrect.tr(context)
                      : QyAppLocalizationKeys.qyIncorrect.tr(context),
                  style: ThemeTextStyles.h4.copyWith(
                    color: _isCorrect ? ThemeColors.success : ThemeColors.error,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (!_isCorrect) ...{
                  SizedBox(height: ThemeDimensions.spacingSmall),
                  Text(
                    '${QyAppLocalizationKeys.qyCorrect.tr(context)}: ${word['word']}',
                    style: ThemeTextStyles.body1.copyWith(
                      color: ThemeColors.textPrimary,
                    ),
                  ),
                },
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLetterGrid() {
    return Wrap(
      spacing: ThemeDimensions.spacingSmall,
      runSpacing: ThemeDimensions.spacingSmall,
      alignment: WrapAlignment.center,
      children: List.generate(
        _availableLetters.length,
        (index) => InkWell(
          onTap: () => _selectLetter(_availableLetters[index], index),
          child: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: ThemeColors.surface,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
              border: Border.all(color: ThemeColors.border),
            ),
            child: Center(
              child: Text(
                _availableLetters[index].toUpperCase(),
                style: ThemeTextStyles.h4.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
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
        child: Row(
          children: [
            if (!_showResult)
              Expanded(
                child: OutlinedButton(
                  onPressed: _showHint,
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
                    QyAppLocalizationKeys.qyHint.tr(context),
                    style: ThemeTextStyles.button.copyWith(
                      color: ThemeColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            if (!_showResult) SizedBox(width: ThemeDimensions.spacingMedium),
            Expanded(
              child: ElevatedButton(
                onPressed: _showResult
                    ? _nextWord
                    : (_selectedLetters.isNotEmpty ? _checkSpelling : null),
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
                  _showResult
                      ? (_currentWordIndex < _spellingWords.length - 1
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
          ],
        ),
      ),
    );
  }
}

class MinimumHeight extends StatelessWidget {
  final double height;
  final Widget child;

  const MinimumHeight({
    super.key,
    required this.height,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: height),
      child: child,
    );
  }
}
