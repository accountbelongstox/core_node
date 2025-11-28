/// Current word card widget for word listening
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, localization
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/buttons/primary_button.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class CurrentWordCard extends StatelessWidget {
  final String word;
  final String phonetic;
  final String translation;
  final String? example;
  final String? exampleTranslation;
  final VoidCallback? onAddToVocabulary;
  final VoidCallback? onMarkAsLearned;

  const CurrentWordCard({
    super.key,
    required this.word,
    required this.phonetic,
    required this.translation,
    this.example,
    this.exampleTranslation,
    this.onAddToVocabulary,
    this.onMarkAsLearned,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing24),
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
                        word,
                        style: ThemeTextStyles.headlineLarge.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing4),
                      Text(
                        phonetic,
                        style: ThemeTextStyles.bodyLarge.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: EdgeInsets.all(ThemeDimensions.spacing12),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                    borderRadius: ThemeDimensions.borderRadiusM,
                  ),
                  child: Icon(
                    Icons.volume_up,
                    color: ColorsAppQy.qyPrimary,
                    size: ThemeDimensions.iconSizeL,
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            Text(
              translation,
              style: ThemeTextStyles.headlineSmall.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (example != null) ...[
              SizedBox(height: ThemeDimensions.spacing16),
              Container(
                width: double.infinity,
                padding: EdgeInsets.all(ThemeDimensions.spacing16),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyFrostWhite.withOpacity(0.8),
                  borderRadius: ThemeDimensions.borderRadiusM,
                  border: Border.all(
                    color: ColorsAppQy.qyPrimary.withOpacity(0.2),
                    width: 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      QyAppLocalizationKeys.qyListeningExample.tr(context),
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        fontWeight: FontWeight.bold,
                        color: ColorsAppQy.qyPrimary,
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.spacing8),
                    Text(
                      example!,
                      style: ThemeTextStyles.bodyLarge.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        height: 1.4,
                      ),
                    ),
                    if (exampleTranslation != null) ...[
                      SizedBox(height: ThemeDimensions.spacing8),
                      Text(
                        exampleTranslation!,
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
            SizedBox(height: ThemeDimensions.spacing16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onAddToVocabulary,
                    icon: Icon(Icons.add_circle_outline),
                    label: Text(QyAppLocalizationKeys.qyListeningAddToVocab.tr(context)),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: ColorsAppQy.qyPrimary),
                      foregroundColor: ColorsAppQy.qyPrimary,
                      padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing12),
                      shape: RoundedRectangleBorder(
                        borderRadius: ThemeDimensions.borderRadiusM,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: ThemeDimensions.spacing12),
                Expanded(
                  child: PrimaryButton(
                    onPressed: onMarkAsLearned,
                    text: QyAppLocalizationKeys.qyWordBookMastered.tr(context),
                    icon: Icons.check_circle,
                    backgroundColor: ColorsAppQy.qyAccent,
                    foregroundColor: ColorsAppQy.qyTextOnPrimary,
                    isFullWidth: true,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      borderRadius: ThemeDimensions.borderRadiusL,
    );
  }
}
