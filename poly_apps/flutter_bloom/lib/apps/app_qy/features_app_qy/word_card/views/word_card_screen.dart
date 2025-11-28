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

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/word_card/controller/word_card_controller.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
// Updated: Using new base theme system (符合最新文档规范)
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
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
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _buildMainContent(),
            ),
            _buildBottomActions(),
          ],
        ),
      ),
    );
  }

  Widget _buildMainContent() {
    return Container(
      padding: ThemeDimensions.paddingM,
      child: Card(
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(15),
        ),
        child: Container(
          padding: const EdgeInsets.all(20),
          child: GetBuilder<WordCardController>(
            builder: (controller) => Builder(
              builder: (context) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    controller.currentWord.word,
                    // Updated: Using base theme system
                    style: ThemeTextStyles.title1Bold,
                  ),
                  SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    controller.currentWord.phonetic,
                    // Updated: Using base theme system
                    style: ThemeTextStyles.callout,
                  ),
                  SizedBox(height: ThemeDimensions.spacing16),
                  Text(
                    controller.currentWord.translation,
                    // Updated: Using base theme system
                    style: ThemeTextStyles.body,
                  ),
                  SizedBox(height: ThemeDimensions.spacing24),
                  Text(
                    '${QyAppLocalizationKeys.qyExamples.tr(context)}:',
                    // Updated: Using base theme system
                    style: ThemeTextStyles.title3Bold,
                  ),
                  SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    controller.currentWord.example,
                    // Updated: Using base theme system
                    style: ThemeTextStyles.body,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomActions() {
    return Container(
      padding: ThemeDimensions.paddingM,
      child: Builder(
        builder: (context) => Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildActionButton(
              context: context,
              icon: Icons.volume_up,
              label: QyAppLocalizationKeys.qyPronunciation.tr(context),
              onPressed: () => Get.find<WordCardController>().playPronunciation(),
            ),
            _buildActionButton(
              context: context,
              icon: Icons.check_circle,
              label: QyAppLocalizationKeys.qyKnown.tr(context),
              onPressed: () => Get.find<WordCardController>().markAsKnown(),
              color: Colors.green,
            ),
            _buildActionButton(
              context: context,
              icon: Icons.close,
              label: QyAppLocalizationKeys.qyUnknown.tr(context),
              onPressed: () => Get.find<WordCardController>().markAsUnknown(),
              color: Colors.red,
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
    return ElevatedButton.icon(
      icon: Icon(icon),
      label: Text(
        label,
        // Updated: Using base theme system
        style: ThemeTextStyles.calloutBold,
      ),
      onPressed: onPressed,
      // Updated: Using base theme system with simple styling
      style: ElevatedButton.styleFrom(
        backgroundColor: color ?? Theme.of(context).colorScheme.primary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
        ),
      ),
    );
  }
}
