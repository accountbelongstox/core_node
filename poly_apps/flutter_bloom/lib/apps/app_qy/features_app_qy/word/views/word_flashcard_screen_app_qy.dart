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
import 'dart:math' as math;
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/word_controller_app_qy.dart';

class WordFlashcardScreenRefactoredAppQy extends StatefulWidget {
  const WordFlashcardScreenRefactoredAppQy({super.key});

  @override
  State<WordFlashcardScreenRefactoredAppQy> createState() =>
      _WordFlashcardScreenRefactoredAppQyState();
}

class _WordFlashcardScreenRefactoredAppQyState
    extends State<WordFlashcardScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late AnimationController _flipController;
  late Animation<double> _flipAnimation;
  bool _showFront = true;
  int _currentIndex = 0;
  final List<Map<String, dynamic>> _flashcards = [];

  @override
  void initState() {
    super.initState();
    _flipController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );
    _flipAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _flipController, curve: Curves.easeInOut),
    );
    _initFlashcards();
  }

  @override
  void dispose() {
    _flipController.dispose();
    super.dispose();
  }

  void _initFlashcards() {
    _flashcards.addAll([
      {
        'word': 'ambitious',
        'phonetic': '/æmˈbɪʃəs/',
        'definition': 'Having a strong desire for success or achievement',
        'examples': [
          'She is very ambitious and wants to become a CEO.',
          'He has ambitious plans for the company.',
        ],
        'synonyms': ['driven', 'determined', 'aspiring'],
      },
      {
        'word': 'collaborate',
        'phonetic': '/kəˈlæbəreɪt/',
        'definition': 'To work jointly with others',
        'examples': [
          'We need to collaborate on this project.',
          'They collaborated to create an amazing product.',
        ],
        'synonyms': ['cooperate', 'work together', 'team up'],
      },
      {
        'word': 'diligent',
        'phonetic': '/ˈdɪlɪdʒənt/',
        'definition': 'Showing care and effort in work or duties',
        'examples': [
          'She is a diligent student who always completes her homework.',
          'His diligent work paid off in the end.',
        ],
        'synonyms': ['hardworking', 'industrious', 'conscientious'],
      },
    ]);
  }

  void _flipCard() {
    if (_flipController.isCompleted) {
      _flipController.reverse();
    } else {
      _flipController.forward();
    }
    setState(() {
      _showFront = !_showFront;
    });
  }

  void _nextCard() {
    if (_currentIndex < _flashcards.length - 1) {
      setState(() {
        _currentIndex++;
        if (!_showFront) {
          _flipCard();
        }
      });
    }
  }

  void _previousCard() {
    if (_currentIndex > 0) {
      setState(() {
        _currentIndex--;
        if (!_showFront) {
          _flipCard();
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
          QyAppLocalizationKeys.qyFlashcards.tr(context),
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
                '${_currentIndex + 1}/${_flashcards.length}',
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
            child: Center(
              child: Padding(
                padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
                child: GestureDetector(
                  onTap: _flipCard,
                  child: AnimatedBuilder(
                    animation: _flipAnimation,
                    builder: (context, child) {
                      final angle = _flipAnimation.value * math.pi;
                      final transform = Matrix4.identity()
                        ..setEntry(3, 2, 0.001)
                        ..rotateY(angle);

                      return Transform(
                        transform: transform,
                        alignment: Alignment.center,
                        child: angle < math.pi / 2
                            ? _buildCardFront()
                            : Transform(
                                transform: Matrix4.identity()..rotateY(math.pi),
                                alignment: Alignment.center,
                                child: _buildCardBack(),
                              ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
          _buildNavigationButtons(),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    final progress = (_currentIndex + 1) / _flashcards.length;

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

  Widget _buildCardFront() {
    final card = _flashcards[_currentIndex];

    return Container(
      width: double.infinity,
      height: 500,
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
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge * 2),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.primary.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.book,
            size: 64,
            color: ThemeColors.surface.withOpacity(0.3),
          ),
          SizedBox(height: ThemeDimensions.spacingLarge * 2),
          Text(
            card['word'] as String,
            style: TextStyle(
              fontSize: 48,
              fontWeight: FontWeight.bold,
              color: ThemeColors.surface,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            card['phonetic'] as String,
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge * 2),
          Icon(
            Icons.touch_app,
            size: 32,
            color: ThemeColors.surface.withOpacity(0.7),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyTapToFlip.tr(context),
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCardBack() {
    final card = _flashcards[_currentIndex];
    final examples = card['examples'] as List<String>;
    final synonyms = card['synonyms'] as List<String>;

    return Container(
      width: double.infinity,
      height: 500,
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge * 2),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge * 2),
        border: Border.all(color: ThemeColors.primary, width: 3),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.2),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Text(
                card['word'] as String,
                style: ThemeTextStyles.h3.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingLarge),
            Text(
              QyAppLocalizationKeys.qyDefinition.tr(context),
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Text(
              card['definition'] as String,
              style: ThemeTextStyles.body2.copyWith(
                color: ThemeColors.textPrimary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingLarge),
            Text(
              QyAppLocalizationKeys.qyExamples.tr(context),
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            ...examples.map((example) {
              return Padding(
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
                          color: ThemeColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
            SizedBox(height: ThemeDimensions.spacingLarge),
            Text(
              QyAppLocalizationKeys.qySynonyms.tr(context),
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Wrap(
              spacing: ThemeDimensions.spacingSmall,
              runSpacing: ThemeDimensions.spacingSmall,
              children: synonyms.map((synonym) {
                return Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingSmall,
                    vertical: ThemeDimensions.paddingXSmall,
                  ),
                  decoration: BoxDecoration(
                    color: ThemeColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                  ),
                  child: Text(
                    synonym,
                    style: ThemeTextStyles.caption.copyWith(
                      color: ThemeColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNavigationButtons() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(top: BorderSide(color: ThemeColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              onPressed: _currentIndex > 0 ? _previousCard : null,
              icon: Icon(Icons.arrow_back),
              iconSize: 32,
              color: _currentIndex > 0
                  ? ThemeColors.primary
                  : ThemeColors.textTertiary,
            ),
            ElevatedButton.icon(
              onPressed: _flipCard,
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.primary,
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingLarge,
                  vertical: ThemeDimensions.paddingMedium,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                ),
              ),
              icon: Icon(Icons.flip, color: ThemeColors.surface),
              label: Text(
                QyAppLocalizationKeys.qyFlip.tr(context),
                style: ThemeTextStyles.button.copyWith(
                  color: ThemeColors.surface,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            IconButton(
              onPressed: _currentIndex < _flashcards.length - 1 ? _nextCard : null,
              icon: Icon(Icons.arrow_forward),
              iconSize: 32,
              color: _currentIndex < _flashcards.length - 1
                  ? ThemeColors.primary
                  : ThemeColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}
