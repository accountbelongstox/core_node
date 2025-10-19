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
import 'package:qyflutter/apps/app_qy/features_app_qy/help/model/help_data_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class AboutUsScreenView extends StatelessWidget {
  const AboutUsScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "About us",
          style: ThemeTextStyles.appNavigation,
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          children: [
            const SizedBox(height: ThemeDimensions.sizeTwentyFive),
            CircleAvatar(
              radius: ThemeDimensions.circleLarge,
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
              child: const Icon(
                Icons.emoji_people,
                size: ThemeDimensions.iconSizeDialog,
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Text(
              "Wecare",
              style: ThemeTextStyles.contentTitle.copyWith(
                  fontSize: ThemeDimensions.fontSizeOverLarge, color: ThemeColors.primaryBrand),
            ),
            const SizedBox(
              height: ThemeDimensions.mediumSize,
            ),
            Text(
              "We Focus on the Digital Charity",
              style: ThemeTextStyles.contentSubtitle.copyWith(fontSize: ThemeDimensions.fontSizeExtraLarge),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Text(aboutUs, style: ThemeTextStyles.contentBody.copyWith(letterSpacing: 1.3))
          ],
        ),
      ),
    );
  }
}
