/// Word item card widget
library;

import 'package:flutter/material.dart';
import '../../../../../../../common/theme/app_theme.dart';
import '../../../../../../../common/widgets/animations/animation_utils.dart';
import '../../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../models/word_models.dart';

class WordItemCard extends StatelessWidget {
  final WordItem word;
  final VoidCallback? onTap;
  final VoidCallback? onAction;

  const WordItemCard({
    super.key,
    required this.word,
    this.onTap,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return AnimationUtils.scaleOnTap(
      onTap: onTap,
      child: AnimationUtils.fadeInWithSlide(
        child: AnimatedContainer(
          duration: ComponentStyles.fastDuration,
          decoration: ComponentStyles.primaryCardDecoration,
          child: Container(
          padding: const EdgeInsets.all(ComponentStyles.lg),
          decoration: BoxDecoration(
            gradient: _getGradientForType(word.type),
            borderRadius: BorderRadius.circular(ComponentStyles.radiusXLarge),
            border: Border.all(
              color: _getTypeColor(word.type).withOpacity(0.2),
              width: 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          word.word,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          word.pronunciation,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[600],
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getTypeColor(word.type).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _getTypeLabel(word.type, context),
                      style: TextStyle(
                        fontSize: 12,
                        color: _getTypeColor(word.type),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: Icon(
                      Icons.more_vert,
                      color: Colors.grey[600],
                    ),
                    onPressed: onAction,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                word.meaning,
                style: const TextStyle(
                  fontSize: 16,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        word.example,
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppTheme.textSecondary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(
                    Icons.headphones,
                    size: 16,
                    color: _getTypeColor(word.type),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    QyAppLocalizationKeys.qyWordBookPronunciation.tr(context),
                    style: TextStyle(
                      fontSize: 12,
                      color: _getTypeColor(word.type),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    QyAppLocalizationKeys.qyWordBookMasteryLevel.tr(context),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: LinearProgressIndicator(
                      value: word.masteryLevel,
                      backgroundColor: Colors.grey.shade300,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _getMasteryColor(word.masteryLevel),
                      ),
                      minHeight: 4,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${(word.masteryLevel * 100).toInt()}%',
                    style: TextStyle(
                      fontSize: 12,
                      color: _getMasteryColor(word.masteryLevel),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }

  LinearGradient _getGradientForType(WordType type) {
    switch (type) {
      case WordType.newWords:
        return AppTheme.newWordsGradient;
      case WordType.learning:
        return AppTheme.learningGradient;
      case WordType.mastered:
        return AppTheme.masteredGradient;
      default:
        return AppTheme.learningGradient;
    }
  }

  Color _getTypeColor(WordType type) {
    switch (type) {
      case WordType.newWords:
        return AppTheme.newColor;
      case WordType.learning:
        return AppTheme.learningColor;
      case WordType.mastered:
        return AppTheme.masteredColor;
      default:
        return AppTheme.learningPrimary;
    }
  }

  String _getTypeLabel(WordType type, BuildContext context) {
    switch (type) {
      case WordType.newWords:
        return QyAppLocalizationKeys.qyWordBookNewWord.tr(context);
      case WordType.learning:
        return QyAppLocalizationKeys.qyWordBookLearning.tr(context);
      case WordType.mastered:
        return QyAppLocalizationKeys.qyWordBookMastered.tr(context);
      default:
        return QyAppLocalizationKeys.qyWordBookAll.tr(context);
    }
  }

  Color _getMasteryColor(double level) {
    if (level < 0.3) {
      return AppTheme.error;
    } else if (level < 0.7) {
      return AppTheme.warning;
    } else {
      return AppTheme.masteredColor;
    }
  }
}