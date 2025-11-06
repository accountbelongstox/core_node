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

class WordTestScreenRefactoredAppQy extends StatefulWidget {
  const WordTestScreenRefactoredAppQy({super.key});

  @override
  State<WordTestScreenRefactoredAppQy> createState() =>
      _WordTestScreenRefactoredAppQyState();
}

class _WordTestScreenRefactoredAppQyState
    extends State<WordTestScreenRefactoredAppQy> {
  int _currentQuestion = 0;
  int _correctAnswers = 0;
  int? _selectedAnswer;
  bool _showAnswer = false;
  final List<Map<String, dynamic>> _questions = [];

  @override
  void initState() {
    super.initState();
    _generateQuestions();
  }

  void _generateQuestions() {
    _questions.addAll([
      {
        'word': 'accomplish',
        'question': 'What does "accomplish" mean?',
        'options': [
          'To achieve or complete successfully',
          'To fail at something',
          'To begin a task',
          'To delay progress',
        ],
        'correctAnswer': 0,
      },
      {
        'word': 'beneficial',
        'question': 'Choose the correct synonym for "beneficial"',
        'options': [
          'Harmful',
          'Advantageous',
          'Neutral',
          'Difficult',
        ],
        'correctAnswer': 1,
      },
      {
        'word': 'comprehensive',
        'question': 'What is the best definition of "comprehensive"?',
        'options': [
          'Simple and easy',
          'Partial and incomplete',
          'Complete and thorough',
          'Quick and brief',
        ],
        'correctAnswer': 2,
      },
      {
        'word': 'diligent',
        'question': 'Select the word closest in meaning to "diligent"',
        'options': [
          'Lazy',
          'Careless',
          'Hardworking',
          'Slow',
        ],
        'correctAnswer': 2,
      },
      {
        'word': 'elaborate',
        'question': 'What does "elaborate" mean as a verb?',
        'options': [
          'To simplify',
          'To explain in detail',
          'To ignore',
          'To summarize briefly',
        ],
        'correctAnswer': 1,
      },
    ]);
  }

  void _selectAnswer(int index) {
    if (!_showAnswer) {
      setState(() {
        _selectedAnswer = index;
      });
    }
  }

  void _checkAnswer() {
    if (_selectedAnswer == null) return;

    final question = _questions[_currentQuestion];
    final isCorrect = _selectedAnswer == question['correctAnswer'];

    setState(() {
      _showAnswer = true;
      if (isCorrect) {
        _correctAnswers++;
      }
    });
  }

  void _nextQuestion() {
    if (_currentQuestion < _questions.length - 1) {
      setState(() {
        _currentQuestion++;
        _selectedAnswer = null;
        _showAnswer = false;
      });
    } else {
      _showResultDialog();
    }
  }

  void _showResultDialog() {
    final percentage = (_correctAnswers / _questions.length * 100).toInt();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Dialog(
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
                percentage >= 80 ? Icons.celebration : Icons.emoji_events,
                size: 80,
                color: ThemeColors.surface,
              ),
              SizedBox(height: Dimensions.spacingMedium),
              Text(
                percentage >= 80
                    ? QyAppLocalizationKeys.qyExcellent.tr(context)
                    : percentage >= 60
                        ? QyAppLocalizationKeys.qyGoodJob.tr(context)
                        : QyAppLocalizationKeys.qyKeepPracticing.tr(context),
                style: TextStyles.h3.copyWith(
                  color: ThemeColors.surface,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: Dimensions.spacingLarge),
              Container(
                padding: EdgeInsets.all(Dimensions.paddingMedium),
                decoration: BoxDecoration(
                  color: ThemeColors.surface.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
                child: Column(
                  children: [
                    Text(
                      QyAppLocalizationKeys.qyYourScore.tr(context),
                      style: TextStyles.body1.copyWith(
                        color: ThemeColors.surface.withOpacity(0.9),
                      ),
                    ),
                    SizedBox(height: Dimensions.spacingSmall),
                    Text(
                      '$percentage%',
                      style: TextStyle(
                        fontSize: 48,
                        fontWeight: FontWeight.bold,
                        color: ThemeColors.surface,
                      ),
                    ),
                    SizedBox(height: Dimensions.spacingSmall),
                    Text(
                      '$_correctAnswers / ${_questions.length} ${QyAppLocalizationKeys.qyCorrect.tr(context)}',
                      style: TextStyles.body2.copyWith(
                        color: ThemeColors.surface.withOpacity(0.9),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: Dimensions.spacingLarge),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        setState(() {
                          _currentQuestion = 0;
                          _correctAnswers = 0;
                          _selectedAnswer = null;
                          _showAnswer = false;
                        });
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ThemeColors.surface,
                        foregroundColor: ThemeColors.primary,
                        padding: EdgeInsets.symmetric(
                          vertical: Dimensions.paddingMedium,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                        ),
                      ),
                      child: Text(
                        QyAppLocalizationKeys.qyRetry.tr(context),
                        style: TextStyles.button.copyWith(
                          color: ThemeColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: Dimensions.spacingMedium),
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
                          vertical: Dimensions.paddingMedium,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                        ),
                      ),
                      child: Text(
                        QyAppLocalizationKeys.qyExit.tr(context),
                        style: TextStyles.button.copyWith(
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

  @override
  Widget build(BuildContext context) {
    final question = _questions[_currentQuestion];
    final options = question['options'] as List<String>;
    final correctAnswer = question['correctAnswer'] as int;

    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyWordTest.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        actions: [
          Padding(
            padding: EdgeInsets.only(right: Dimensions.paddingMedium),
            child: Center(
              child: Text(
                '${_currentQuestion + 1}/${_questions.length}',
                style: TextStyles.body1.copyWith(
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
              padding: EdgeInsets.all(Dimensions.paddingLarge),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildQuestionCard(question),
                  SizedBox(height: Dimensions.spacingLarge),
                  ...List.generate(
                    options.length,
                    (index) => Padding(
                      padding: EdgeInsets.only(bottom: Dimensions.spacingMedium),
                      child: _buildOptionCard(
                        options[index],
                        index,
                        correctAnswer,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _buildActionButton(),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    final progress = (_currentQuestion + 1) / _questions.length;

    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${QyAppLocalizationKeys.qyProgress.tr(context)}: ${(progress * 100).toInt()}%',
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              Text(
                '${QyAppLocalizationKeys.qyCorrect.tr(context)}: $_correctAnswers',
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingSmall),
          ClipRRect(
            borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
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

  Widget _buildQuestionCard(Map<String, dynamic> question) {
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
        children: [
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: Dimensions.paddingMedium,
              vertical: Dimensions.paddingSmall,
            ),
            decoration: BoxDecoration(
              color: ThemeColors.surface.withOpacity(0.2),
              borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
            ),
            child: Text(
              question['word'] as String,
              style: TextStyles.h2.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            question['question'] as String,
            style: TextStyles.h4.copyWith(
              color: ThemeColors.surface,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildOptionCard(String option, int index, int correctAnswer) {
    final isSelected = _selectedAnswer == index;
    final isCorrect = index == correctAnswer;
    final showResult = _showAnswer;

    Color backgroundColor;
    Color borderColor;
    Color textColor;

    if (showResult) {
      if (isCorrect) {
        backgroundColor = ThemeColors.success.withOpacity(0.1);
        borderColor = ThemeColors.success;
        textColor = ThemeColors.success;
      } else if (isSelected) {
        backgroundColor = ThemeColors.error.withOpacity(0.1);
        borderColor = ThemeColors.error;
        textColor = ThemeColors.error;
      } else {
        backgroundColor = ThemeColors.surface;
        borderColor = ThemeColors.border;
        textColor = ThemeColors.textSecondary;
      }
    } else {
      backgroundColor = isSelected
          ? ThemeColors.primary.withOpacity(0.1)
          : ThemeColors.surface;
      borderColor = isSelected ? ThemeColors.primary : ThemeColors.border;
      textColor = isSelected ? ThemeColors.primary : ThemeColors.textPrimary;
    }

    return InkWell(
      onTap: () => _selectAnswer(index),
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(color: borderColor, width: 2),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: borderColor.withOpacity(0.2),
                shape: BoxShape.circle,
                border: Border.all(color: borderColor, width: 2),
              ),
              child: Center(
                child: Text(
                  String.fromCharCode(65 + index),
                  style: TextStyles.body1.copyWith(
                    color: borderColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: Text(
                option,
                style: TextStyles.body1.copyWith(
                  color: textColor,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            if (showResult && isCorrect)
              Icon(Icons.check_circle, color: ThemeColors.success),
            if (showResult && isSelected && !isCorrect)
              Icon(Icons.cancel, color: ThemeColors.error),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(top: BorderSide(color: ThemeColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _showAnswer
                ? _nextQuestion
                : (_selectedAnswer != null ? _checkAnswer : null),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primary,
              disabledBackgroundColor: ThemeColors.textTertiary,
              padding: EdgeInsets.symmetric(vertical: Dimensions.paddingMedium),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              ),
            ),
            child: Text(
              _showAnswer
                  ? (_currentQuestion < _questions.length - 1
                      ? QyAppLocalizationKeys.qyNext.tr(context)
                      : QyAppLocalizationKeys.qyFinish.tr(context))
                  : QyAppLocalizationKeys.qyCheck.tr(context),
              style: TextStyles.button.copyWith(
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
