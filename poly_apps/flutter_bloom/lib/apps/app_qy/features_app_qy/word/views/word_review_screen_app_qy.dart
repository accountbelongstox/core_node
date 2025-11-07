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

class WordReviewScreenRefactoredAppQy extends StatefulWidget {
  const WordReviewScreenRefactoredAppQy({super.key});

  @override
  State<WordReviewScreenRefactoredAppQy> createState() =>
      _WordReviewScreenRefactoredAppQyState();
}

class _WordReviewScreenRefactoredAppQyState
    extends State<WordReviewScreenRefactoredAppQy> {
  int _currentWordIndex = 0;
  bool _showDefinition = false;
  final List<Map<String, dynamic>> _reviewWords = [];

  @override
  void initState() {
    super.initState();
    _initReviewWords();
  }

  void _initReviewWords() {
    _reviewWords.addAll([
      {
        'word': 'meticulous',
        'phonetic': '/məˈtɪkjələs/',
        'definition': 'Showing great attention to detail; very careful and precise',
        'examples': [
          'She is meticulous about keeping her workspace clean.',
          'The detective conducted a meticulous investigation.',
        ],
        'mastery': 0.7,
        'lastReviewed': '2 days ago',
      },
      {
        'word': 'resilient',
        'phonetic': '/rɪˈzɪliənt/',
        'definition': 'Able to withstand or recover quickly from difficult conditions',
        'examples': [
          'Children are often more resilient than adults.',
          'The economy proved resilient despite the challenges.',
        ],
        'mastery': 0.85,
        'lastReviewed': '1 day ago',
      },
      {
        'word': 'ambiguous',
        'phonetic': '/æmˈbɪɡjuəs/',
        'definition': 'Open to more than one interpretation; not having one obvious meaning',
        'examples': [
          'His ambiguous answer left everyone confused.',
          'The instructions were too ambiguous to follow.',
        ],
        'mastery': 0.5,
        'lastReviewed': '5 days ago',
      },
    ]);
  }

  void _nextWord() {
    if (_currentWordIndex < _reviewWords.length - 1) {
      setState(() {
        _currentWordIndex++;
        _showDefinition = false;
      });
    } else {
      _showCompletionDialog();
    }
  }

  void _previousWord() {
    if (_currentWordIndex > 0) {
      setState(() {
        _currentWordIndex--;
        _showDefinition = false;
      });
    }
  }

  void _toggleDefinition() {
    setState(() {
      _showDefinition = !_showDefinition;
    });
  }

  void _markAsKnown() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyMarkedAsKnown.tr(context)),
        duration: const Duration(seconds: 1),
      ),
    );
    _nextWord();
  }

  void _markAsNeedReview() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyMarkedForReview.tr(context)),
        duration: const Duration(seconds: 1),
      ),
    );
    _nextWord();
  }

  void _showCompletionDialog() {
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
              Icon(Icons.check_circle, size: 80, color: ThemeColors.surface),
              SizedBox(height: ThemeDimensions.spacingMedium),
              Text(
                QyAppLocalizationKeys.qyReviewComplete.tr(context),
                style: ThemeTextStyles.h3.copyWith(
                  color: ThemeColors.surface,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              Text(
                '${QyAppLocalizationKeys.qyReviewed.tr(context)} ${_reviewWords.length} ${QyAppLocalizationKeys.qyWords.tr(context)}',
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
    final word = _reviewWords[_currentWordIndex];

    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyWordReview.tr(context),
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
                '${_currentWordIndex + 1}/${_reviewWords.length}',
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
                  _buildWordCard(word),
                  SizedBox(height: ThemeDimensions.spacingLarge),
                  _buildMasteryIndicator(word),
                  if (_showDefinition) ...[
                    SizedBox(height: ThemeDimensions.spacingLarge),
                    _buildDefinitionCard(word),
                  ],
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
    final progress = (_currentWordIndex + 1) / _reviewWords.length;

    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
        child: LinearProgressIndicator(
          value: progress,
          minHeight: 6,
          backgroundColor: ThemeColors.border,
          valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
        ),
      ),
    );
  }

  Widget _buildWordCard(Map<String, dynamic> word) {
    return InkWell(
      onTap: _toggleDefinition,
      child: Container(
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
            Text(
              word['word'] as String,
              style: TextStyle(
                fontSize: 48,
                fontWeight: FontWeight.bold,
                color: ThemeColors.surface,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              word['phonetic'] as String,
              style: ThemeTextStyles.h4.copyWith(
                color: ThemeColors.surface.withOpacity(0.9),
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingLarge),
            IconButton(
              onPressed: () {},
              icon: Icon(
                Icons.volume_up,
                size: 40,
                color: ThemeColors.surface,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              _showDefinition
                  ? QyAppLocalizationKeys.qyTapToHide.tr(context)
                  : QyAppLocalizationKeys.qyTapToReveal.tr(context),
              style: ThemeTextStyles.caption.copyWith(
                color: ThemeColors.surface.withOpacity(0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMasteryIndicator(Map<String, dynamic> word) {
    final mastery = word['mastery'] as double;
    final percentage = (mastery * 100).toInt();

    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyMasteryLevel.tr(context),
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                '$percentage%',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: mastery,
              minHeight: 8,
              backgroundColor: ThemeColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(
                mastery >= 0.8
                    ? ThemeColors.success
                    : mastery >= 0.5
                        ? Colors.orange
                        : ThemeColors.error,
              ),
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            '${QyAppLocalizationKeys.qyLastReviewed.tr(context)}: ${word['lastReviewed']}',
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDefinitionCard(Map<String, dynamic> word) {
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
            QyAppLocalizationKeys.qyDefinition.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            word['definition'] as String,
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyExamples.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          ...(word['examples'] as List<String>).map(
            (example) => Padding(
              padding: EdgeInsets.only(bottom: ThemeDimensions.spacingSmall),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '• ',
                    style: ThemeTextStyles.body2.copyWith(
                      color: ThemeColors.primary,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      example,
                      style: ThemeTextStyles.body2.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
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
        border: Border(top: BorderSide(color: ThemeColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _markAsNeedReview,
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: ThemeColors.error),
                      padding: EdgeInsets.symmetric(
                        vertical: ThemeDimensions.paddingMedium,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                      ),
                    ),
                    icon: Icon(Icons.replay, color: ThemeColors.error),
                    label: Text(
                      QyAppLocalizationKeys.qyNeedReview.tr(context),
                      style: ThemeTextStyles.button.copyWith(
                        color: ThemeColors.error,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: ThemeDimensions.spacingMedium),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _markAsKnown,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ThemeColors.success,
                      padding: EdgeInsets.symmetric(
                        vertical: ThemeDimensions.paddingMedium,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                      ),
                    ),
                    icon: Icon(Icons.check, color: ThemeColors.surface),
                    label: Text(
                      QyAppLocalizationKeys.qyKnown.tr(context),
                      style: ThemeTextStyles.button.copyWith(
                        color: ThemeColors.surface,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  onPressed: _currentWordIndex > 0 ? _previousWord : null,
                  icon: Icon(
                    Icons.arrow_back,
                    color: _currentWordIndex > 0
                        ? ThemeColors.primary
                        : ThemeColors.textTertiary,
                  ),
                ),
                TextButton(
                  onPressed: _toggleDefinition,
                  child: Text(
                    _showDefinition
                        ? QyAppLocalizationKeys.qyHideDefinition.tr(context)
                        : QyAppLocalizationKeys.qyShowDefinition.tr(context),
                    style: ThemeTextStyles.button.copyWith(
                      color: ThemeColors.primary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _nextWord,
                  icon: Icon(Icons.arrow_forward, color: ThemeColors.primary),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
