// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/word_card/controller/word_card_controller.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_effects.dart';
import 'package:qyflutter/common/theme/base/theme_gradients.dart';
import 'package:qyflutter/common/theme/base/theme_animations.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class WordCardScreen extends StatelessWidget {
  const WordCardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(WordCardController());

    return Scaffold(
      appBar: CustomAppBar(
        title: QyAppLocalizationKeys.qyWordLearning.tr(context),
        showBackButton: true,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: ThemeGradients.holographicWhite,
        ),
        child: SafeArea(
          child: Stack(
            children: [
              // Blur background effect
              ThemeEffects.blurBackground(
                blurAmount: 20.0,
                backgroundColor: Colors.white.withOpacity(0.1),
                child: Container(),
              ),
              // Main content with bento box layout
              Column(
                children: [
                  Expanded(
                    child: _buildMainContent(context, controller),
                  ),
                  _buildBottomActions(context, controller),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMainContent(BuildContext context, WordCardController controller) {
    return Container(
      padding: ThemeDimensions.paddingM,
      child: GetBuilder<WordCardController>(
        builder: (_) => Builder(
          builder: (ctx) {
            final word = controller.currentWord;
            // Bento box layout with glass morphism cards
            return GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: ThemeDimensions.spacingM,
              mainAxisSpacing: ThemeDimensions.spacingM,
              childAspectRatio: 1.2,
              children: [
                // Word card - spans 2 columns
                GlassCard(
                  padding: ThemeDimensions.paddingL,
                  margin: EdgeInsets.zero,
                  borderRadius: ThemeDimensions.borderRadiusL,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        word.word,
                        style: ThemeTextStyles.title1Bold.copyWith(
                          color: ThemeColors.textPrimary,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing8),
                      Text(
                        word.phonetic,
                        style: ThemeTextStyles.callout.copyWith(
                          color: ThemeColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                // Translation card
                GlassCard(
                  padding: ThemeDimensions.paddingM,
                  margin: EdgeInsets.zero,
                  borderRadius: ThemeDimensions.borderRadiusL,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyDefinition.tr(ctx),
                        style: ThemeTextStyles.caption.copyWith(
                          color: ThemeColors.textSecondary,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing4),
                      Expanded(
                        child: Text(
                          word.translation,
                          style: ThemeTextStyles.body.copyWith(
                            color: ThemeColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Example card - spans 2 columns
                GlassCard(
                  padding: ThemeDimensions.paddingM,
                  margin: EdgeInsets.zero,
                  borderRadius: ThemeDimensions.borderRadiusL,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyExamples.tr(ctx),
                        style: ThemeTextStyles.title3Bold.copyWith(
                          color: ThemeColors.textPrimary,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing8),
                      Expanded(
                        child: Text(
                          word.example,
                          style: ThemeTextStyles.body.copyWith(
                            color: ThemeColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildBottomActions(BuildContext context, WordCardController controller) {
    return Container(
      padding: ThemeDimensions.paddingM,
      child: GlassCard(
        padding: ThemeDimensions.paddingM,
        margin: EdgeInsets.zero,
        borderRadius: ThemeDimensions.borderRadiusL,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildActionButton(
              context: context,
              icon: Icons.volume_up,
              label: QyAppLocalizationKeys.qyPronunciation.tr(context),
              onPressed: () => controller.playPronunciation(),
            ),
            _buildActionButton(
              context: context,
              icon: Icons.check_circle,
              label: QyAppLocalizationKeys.qyKnown.tr(context),
              onPressed: () => controller.markAsKnown(),
              color: ThemeColors.success,
            ),
            _buildActionButton(
              context: context,
              icon: Icons.close,
              label: QyAppLocalizationKeys.qyUnknown.tr(context),
              onPressed: () => controller.markAsUnknown(),
              color: ThemeColors.error,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required BuildContext context,
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    Color? color,
  }) {
    return Container(
      decoration: ThemeEffects.glassmorphism(
        color: color ?? ThemeColors.primary,
        opacity: 0.3,
        borderRadius: ThemeDimensions.borderRadiusM,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: ThemeDimensions.borderRadiusM,
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.spacingM,
              vertical: ThemeDimensions.spacingS,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  color: color ?? ThemeColors.primary,
                  size: ThemeDimensions.iconSizeM,
                ),
                SizedBox(width: ThemeDimensions.spacingS),
                Text(
                  label,
                  style: ThemeTextStyles.calloutBold.copyWith(
                    color: color ?? ThemeColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
