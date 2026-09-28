/// Word statistics card widget
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../data/word_book_data.dart';
import '../models/word_models.dart';

class WordStatsCard extends StatelessWidget {
  const WordStatsCard({super.key});

  @override
  Widget build(BuildContext context) {
    final total = WordBookData.countByType(WordType.all);
    final learning = WordBookData.countByType(WordType.learning);
    final newWords = WordBookData.countByType(WordType.newWords);
    final mastered = WordBookData.countByType(WordType.mastered);

    return GlassCard(
      borderRadius: ThemeDimensions.borderRadiusXL,
      padding: EdgeInsets.all(ThemeDimensions.spacing20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyWordBookStatsTitle.tr(context),
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacing12,
                  vertical: ThemeDimensions.spacing4,
                ),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                  borderRadius: ThemeDimensions.borderRadiusS,
                ),
                child: Text(
                  '${(WordBookData.masteryProgress() * 100).toInt()}% ${QyAppLocalizationKeys.qyWordBookMasteryLevel.tr(context)}',
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ColorsAppQy.qyPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing16),
          Row(
            children: [
              Expanded(
                child: _buildStatItem(
                  context,
                  Icons.book_outlined,
                  QyAppLocalizationKeys.qyWordBookWordCount.tr(context),
                  total.toString(),
                  ColorsAppQy.qyPrimary,
                ),
              ),
              _buildDivider(),
              Expanded(
                child: _buildStatItem(
                  context,
                  Icons.school_outlined,
                  QyAppLocalizationKeys.qyWordBookLearningCount.tr(context),
                  learning.toString(),
                  ColorsAppQy.qySecondary,
                ),
              ),
              _buildDivider(),
              Expanded(
                child: _buildStatItem(
                  context,
                  Icons.add_circle_outline,
                  QyAppLocalizationKeys.qyWordBookNewCount.tr(context),
                  newWords.toString(),
                  ColorsAppQy.qyAccent,
                ),
              ),
              _buildDivider(),
              Expanded(
                child: _buildStatItem(
                  context,
                  Icons.check_circle_outline,
                  QyAppLocalizationKeys.qyWordBookMasteredCount.tr(context),
                  mastered.toString(),
                  ColorsAppQy.qyPrimaryDark,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(
    BuildContext context,
    IconData icon,
    String label,
    String value,
    Color color,
  ) {
    return Column(
      children: [
        Container(
          padding: EdgeInsets.all(ThemeDimensions.spacing10),
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: ThemeDimensions.borderRadiusM,
          ),
          child: Icon(
            icon,
            color: color,
            size: ThemeDimensions.iconSizeL,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacing8),
        Text(
          value,
          style: ThemeTextStyles.headlineSmall.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacing4),
        Text(
          label,
          style: ThemeTextStyles.bodySmall.copyWith(
            color: ColorsAppQy.qyTextSecondary,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildDivider() {
    return Container(
      width: 1,
      height: ThemeDimensions.spacing40,
      color: ColorsAppQy.qyBorderLight,
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing8),
    );
  }
}
