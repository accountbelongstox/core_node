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
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/authentication/views/select_country.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:get/get.dart';

class CongratulationScreen extends StatelessWidget {
  const CongratulationScreen({super.key});
  @override
  Widget build(BuildContext context) {
    // Using common text styles directly

    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeLarge),
        child: Column(
          children: [
            const SizedBox(
              height: ThemeDimensions.bigExtraSize,
            ),
            Center(
              child: CircleAvatar(
                radius: ThemeDimensions.radiusBig,
                backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                child: CircleAvatar(
                    radius: ThemeDimensions.radiusBig,
                    backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                    child: const Icon(
                      Icons.emoji_people,
                      size: ThemeDimensions.fortySize,
                      color: ThemeColors.white,
                    )),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.bigSize,
            ),
            Text(
              "Congratulations!",
              style: ThemeTextStyles.contentTitle.copyWith(
                  color: Theme.of(context).colorScheme.surfaceTint),
            ),
            const SizedBox(
              height: ThemeDimensions.sizeFifteen,
            ),
            Text(
              "Your account is ready to use",
              style: ThemeTextStyles.contentBody,
            ),
            const SizedBox(
              height: ThemeDimensions.bigSize,
            ),
            CustomButton(
              radius: ThemeDimensions.radiusBig,
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
              borderColor: Theme.of(context).colorScheme.surfaceTint,
              height: ThemeDimensions.largeExtraSize,
              width: double.infinity,
              buttonText: "Go to Homepage",
              onPressed: () {
                Get.to(const SelectCountryScreen());
              },
            ),
            const SizedBox(
              height: ThemeDimensions.mediumSize,
            )
          ],
        ),
      ),
    );
  }
}
