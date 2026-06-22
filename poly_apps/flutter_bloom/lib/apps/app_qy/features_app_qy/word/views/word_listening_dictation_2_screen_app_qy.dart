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
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordListeningDictation2ScreenRefactoredAppQy extends StatefulWidget {
  const WordListeningDictation2ScreenRefactoredAppQy({super.key});

  @override
  State<WordListeningDictation2ScreenRefactoredAppQy> createState() =>
      _WordListeningDictation2ScreenRefactoredAppQyState();
}

class _WordListeningDictation2ScreenRefactoredAppQyState
    extends State<WordListeningDictation2ScreenRefactoredAppQy> {
  bool _showResult;
  bool _isCorrect;
  String _userAnswer;
  String _correctAnswer;

  _WordListeningDictation2ScreenRefactoredAppQyState()
      : _showResult = true,
        _isCorrect = false,
        _userAnswer = 'exmple',
        _correctAnswer = 'example';

  void _continueNext() {
    setState(() {
      _showResult = false;
    });
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
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: _buildResultCard(),
              ),
            ),
            _buildContinueButton(),
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.paddingLarge),
      padding: EdgeInsets.all(ThemeDimensions.paddingXLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(
          color: _isCorrect
              ? ThemeColors.success
              : ThemeColors.error,
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: (_isCorrect
                    ? ThemeColors.success
                    : ThemeColors.error)
                .withOpacity(0.2),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _isCorrect ? Icons.check_circle : Icons.cancel,
            size: 80,
            color: _isCorrect ? ThemeColors.success : ThemeColors.error,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            _isCorrect
                ? QyAppLocalizationKeys.qyCorrect.tr(context)
                : QyAppLocalizationKeys.qyIncorrect.tr(context),
            style: ThemeTextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildAnswerComparison(),
        ],
      ),
    );
  }

  Widget _buildAnswerComparison() {
    return Column(
      children: [
        Container(
          padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
          decoration: BoxDecoration(
            color: ThemeColors.error.withOpacity(0.1),
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                QyAppLocalizationKeys.qyYourAnswer.tr(context),
                style: ThemeTextStyles.caption.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingXSmall),
              Text(
                _userAnswer,
                style: ThemeTextStyles.h4.copyWith(
                  color: ThemeColors.error,
                  decoration: TextDecoration.lineThrough,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        Container(
          padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
          decoration: BoxDecoration(
            color: ThemeColors.success.withOpacity(0.1),
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                QyAppLocalizationKeys.qyCorrectAnswer.tr(context),
                style: ThemeTextStyles.caption.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingXSmall),
              Text(
                _correctAnswer,
                style: ThemeTextStyles.h4.copyWith(
                  color: ThemeColors.success,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildContinueButton() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _continueNext,
          style: ElevatedButton.styleFrom(
            backgroundColor: ThemeColors.primary,
            padding: EdgeInsets.symmetric(vertical: ThemeDimensions.paddingMedium),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
          ),
          child: Text(
            QyAppLocalizationKeys.qyContinue.tr(context),
            style: ThemeTextStyles.button.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
}
