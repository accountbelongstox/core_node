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

class WordListeningDictation1ScreenRefactoredAppQy extends StatefulWidget {
  const WordListeningDictation1ScreenRefactoredAppQy({super.key});

  @override
  State<WordListeningDictation1ScreenRefactoredAppQy> createState() =>
      _WordListeningDictation1ScreenRefactoredAppQyState();
}

class _WordListeningDictation1ScreenRefactoredAppQyState
    extends State<WordListeningDictation1ScreenRefactoredAppQy> {
  final TextEditingController _inputController;
  String _currentWord;
  int _currentIndex;
  int _totalWords;

  _WordListeningDictation1ScreenRefactoredAppQyState()
      : _inputController = TextEditingController(),
        _currentWord = 'example',
        _currentIndex = 1,
        _totalWords = 10;

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  void _playAudio() {}

  void _submitAnswer() {
    final answer = _inputController.text.trim();
    if (answer.isNotEmpty) {
      _inputController.clear();
      setState(() {
        if (_currentIndex < _totalWords) {
          _currentIndex++;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyWordDictation.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
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
            _buildProgress(),
            Expanded(
              child: Center(
                child: _buildDictationCard(),
              ),
            ),
            _buildInputArea(),
            _buildButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildProgress() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$_currentIndex / $_totalWords',
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                QyAppLocalizationKeys.qyProgress.tr(context),
                style: TextStyles.body2.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingSmall),
          ClipRRect(
            borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: _currentIndex / _totalWords,
              minHeight: 6,
              backgroundColor: ThemeColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDictationCard() {
    return Container(
      margin: EdgeInsets.all(Dimensions.paddingLarge),
      padding: EdgeInsets.all(Dimensions.paddingXLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.headphones,
            size: 64,
            color: ThemeColors.primary,
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyListenAndType.tr(context),
            style: TextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: Dimensions.spacingMedium),
          IconButton(
            onPressed: _playAudio,
            icon: Icon(Icons.play_circle_filled),
            iconSize: 80,
            color: ThemeColors.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: TextField(
        controller: _inputController,
        style: TextStyles.h4.copyWith(color: ThemeColors.textPrimary),
        textAlign: TextAlign.center,
        decoration: InputDecoration(
          hintText: QyAppLocalizationKeys.qyTypeHere.tr(context),
          hintStyle: TextStyles.body1.copyWith(
            color: ThemeColors.textTertiary,
          ),
          filled: true,
          fillColor: ThemeColors.surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            borderSide: BorderSide(color: ThemeColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            borderSide: BorderSide(color: ThemeColors.primary, width: 2),
          ),
        ),
        onSubmitted: (_) => _submitAnswer(),
      ),
    );
  }

  Widget _buildButtons() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _playAudio,
              style: OutlinedButton.styleFrom(
                padding: EdgeInsets.symmetric(vertical: Dimensions.paddingMedium),
                side: BorderSide(color: ThemeColors.primary),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
              ),
              icon: Icon(Icons.volume_up, color: ThemeColors.primary),
              label: Text(
                QyAppLocalizationKeys.qyPlayAgain.tr(context),
                style: TextStyles.button.copyWith(
                  color: ThemeColors.primary,
                ),
              ),
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: ElevatedButton(
              onPressed: _submitAnswer,
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.primary,
                padding: EdgeInsets.symmetric(vertical: Dimensions.paddingMedium),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
              ),
              child: Text(
                QyAppLocalizationKeys.qySubmit.tr(context),
                style: TextStyles.button.copyWith(
                  color: ThemeColors.surface,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
