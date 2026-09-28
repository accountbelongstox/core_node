/// Word item card widget
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
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
      onTap: onTap ?? () {},
      child: AnimationUtils.fadeInWithSlide(
        GlassCard(
          onTap: onTap,
          borderRadius: ThemeDimensions.borderRadiusXL,
          padding: EdgeInsets.all(ThemeDimensions.spacing20),
          child: Container(
            decoration: BoxDecoration(
              gradient: _getGradientForType(word.type),
              borderRadius: ThemeDimensions.borderRadiusXL,
              border: Border.all(
                color: _getTypeColor(word.type).withOpacity(0.2),
                width: 1.0,
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
                            style: ThemeTextStyles.headlineSmall.copyWith(
                              color: ColorsAppQy.qyTextPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: ThemeDimensions.spacing4),
                          Text(
                            word.pronunciation,
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyTextSecondary,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: ThemeDimensions.spacing12,
                        vertical: ThemeDimensions.spacing4,
                      ),
                      decoration: BoxDecoration(
                        color: _getTypeColor(word.type).withOpacity(0.12),
                        borderRadius: ThemeDimensions.borderRadiusS,
                      ),
                      child: Text(
                        _getTypeLabel(word.type, context),
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: _getTypeColor(word.type),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    SizedBox(width: ThemeDimensions.spacing8),
                    IconButton(
                      icon: Icon(
                        Icons.more_vert,
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                      onPressed: onAction,
                    ),
                  ],
                ),
                SizedBox(height: ThemeDimensions.spacing12),
                Text(
                  word.meaningKey.tr(context),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacing12),
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.all(ThemeDimensions.spacing12),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyFrostWhite,
                    borderRadius: ThemeDimensions.borderRadiusM,
                  ),
                  child: Text(
                    word.exampleKey.tr(context),
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacing16),
                Row(
                  children: [
                    Icon(
                      Icons.headphones,
                      size: ThemeDimensions.iconSizeS,
                      color: _getTypeColor(word.type),
                    ),
                    SizedBox(width: ThemeDimensions.spacing4),
                    Text(
                      QyAppLocalizationKeys.qyWordBookPronunciation.tr(context),
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: _getTypeColor(word.type),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      QyAppLocalizationKeys.qyWordBookMasteryLevel.tr(context),
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: ThemeDimensions.spacing8),
                Row(
                  children: [
                    Expanded(
                      child: LinearProgressIndicator(
                        value: word.masteryLevel,
                        backgroundColor: ColorsAppQy.qyHolographicMedium,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          _getMasteryColor(word.masteryLevel),
                        ),
                        minHeight: ThemeDimensions.spacing4,
                      ),
                    ),
                    SizedBox(width: ThemeDimensions.spacing8),
                    Text(
                      '${(word.masteryLevel * 100).toInt()}%',
                      style: ThemeTextStyles.bodySmall.copyWith(
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
        return ColorsAppQy.qyAccentGradient;
      case WordType.learning:
        return ColorsAppQy.qySecondaryGradient;
      case WordType.mastered:
        return ColorsAppQy.qyPrimaryGradient;
      default:
        return ColorsAppQy.qyHolographicGradient;
    }
  }

  Color _getTypeColor(WordType type) {
    switch (type) {
      case WordType.newWords:
        return ColorsAppQy.qyAccent;
      case WordType.learning:
        return ColorsAppQy.qySecondary;
      case WordType.mastered:
        return ColorsAppQy.qyPrimary;
      default:
        return ColorsAppQy.qyInfo;
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
      return ColorsAppQy.qyWarning;
    } else if (level < 0.7) {
      return ColorsAppQy.qySecondary;
    } else {
      return ColorsAppQy.qyPrimary;
    }
  }
}
