/// Current word card widget for word listening
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class CurrentWordCard extends StatelessWidget {
  final String word;
  final String phonetic;
  final String translation;
  final String? example;

  const CurrentWordCard({
    super.key,
    required this.word,
    required this.phonetic,
    required this.translation,
    this.example,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              word,
              style: ThemeTextStyles.headlineLarge.copyWith(
                fontWeight: FontWeight.bold,
                color: ColorsAppQy.qyPrimary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing8),
            Text(
              phonetic,
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: ColorsAppQy.qyTextSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            Text(
              translation,
              style: ThemeTextStyles.headlineSmall.copyWith(
                color: ColorsAppQy.qyTextPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            if (example != null) ...[
              SizedBox(height: ThemeDimensions.spacing16),
              Container(
                padding: EdgeInsets.all(ThemeDimensions.spacing12),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                  borderRadius: ThemeDimensions.borderRadiusS,
                ),
                child: Text(
                  example!,
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ],
        ),
      ),
      borderRadius: ThemeDimensions.borderRadiusL,
    );
  }
}
