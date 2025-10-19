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
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:get/get.dart';

class VerifyScreenView extends StatelessWidget {
  const VerifyScreenView({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).cardColor,
      appBar: const CustomAppBar(
        title: "Forgot Password",
        regularAppbar: true,
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeDefault),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Align(
                alignment: Alignment.center,
                child: Text(
                  "Code has been sand to 1246***65",
                  style: ThemeTextStyles.textMedium,
                )),
            Padding(
              padding: EdgeInsets.symmetric(
                  vertical: ThemeDimensions.paddingSizeOverLarge,
                  horizontal: ThemeDimensions.paddingSizeDefault),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  CustomCircular(
                    height: ThemeDimensions.largeExtraSize,
                    width: ThemeDimensions.largeSixtySize,
                    outlineColor: Theme.of(context).colorScheme.surfaceTint,
                    radius: ThemeDimensions.radiusDefault,
                  ),
                  CustomCircular(
                    height: ThemeDimensions.largeExtraSize,
                    width: ThemeDimensions.largeSixtySize,
                    outlineColor: Theme.of(context).colorScheme.surfaceTint,
                    radius: ThemeDimensions.radiusDefault,
                  ),
                  CustomCircular(
                    height: ThemeDimensions.largeExtraSize,
                    width: ThemeDimensions.largeSixtySize,
                    outlineColor: Theme.of(context).colorScheme.surfaceTint,
                    radius: ThemeDimensions.radiusDefault,
                  ),
                  CustomCircular(
                    height: ThemeDimensions.largeExtraSize,
                    width: ThemeDimensions.largeSixtySize,
                    outlineColor: Theme.of(context).colorScheme.surfaceTint,
                    radius: ThemeDimensions.radiusDefault,
                  ),
                ],
              ),
            ),
            const Text(
              "Resend code in 60 ,s",
              style: ThemeTextStyles.textSemiBold,
            ),
            const SizedBox(
              height: ThemeDimensions.bigMediumSize,
            ),
            CustomButton(
              radius: ThemeDimensions.radiusBig,
              onPressed: () {
                Get.offAllNamed(QyAppRoutesProvider.routeReset);
              },
              buttonText: "Verify",
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
              borderColor: Theme.of(context).colorScheme.surfaceTint,
              height: ThemeDimensions.largeExtraSize,
              width: double.infinity,
            ),
          ],
        ),
      ),
    );
  }
}
