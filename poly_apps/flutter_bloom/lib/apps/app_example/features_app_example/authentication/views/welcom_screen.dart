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
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:get/get.dart';

class WelcomeScreenView extends StatelessWidget {
  const WelcomeScreenView({super.key});
  @override
  Widget build(BuildContext context) {
    // Using common text styles directly

    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeSmall),
        child: SingleChildScrollView(
          scrollDirection: Axis.vertical,
          child: Column(
            children: [
              //   const SizedBox(height: ThemeDimensions.bigSize,),
              // Image.asset(CommonAssetsIcons.welcome,height: ThemeDimensions.bigMediumSize,),

              SizedBox(height: ThemeDimensions.paddingSizeOver),
              Center(
                child: CircleAvatar(
                    radius: ThemeDimensions.radiusBig,
                    backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                    child: const Icon(
                      Icons.emoji_people,
                      size: ThemeDimensions.fortySize,
                      color: Colors.white,
                    )),
              ),
              const SizedBox(
                height: ThemeDimensions.sizeTwenty,
              ),
              Text(
                "Wecare".tr,
                style: ThemeTextStyles.textSemiBold.copyWith(
                    color: Theme.of(context).colorScheme.secondary,
                    fontSize: ThemeDimensions.fontSizeDefault),
              ),

              Padding(
                  padding: const EdgeInsets.symmetric(
                      vertical: ThemeDimensions.paddingSizeLarge),
                  child: Text("Let's you in",
                      style: ThemeTextStyles.textBold.copyWith(
                        fontSize: 24,
                        color: ThemeColors.black,
                      ))),
              OuteLineBorder(
                height: ThemeDimensions.largeExtraSize,
                widget: Center(
                    child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(
                      width: ThemeDimensions.sizeFifteen,
                    ),
                    Image.asset(
                      CommonAssetsIcons.facebook,
                      height: ThemeDimensions.sizeTwentyFive,
                      fit: BoxFit.cover,
                    ),
                    const SizedBox(
                      width: ThemeDimensions.sizeFifteen,
                    ),
                    Text("Facebook", style: ThemeTextStyles.contentBody),
                  ],
                )),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.paddingSizeLarge),
                child: OuteLineBorder(
                    height: ThemeDimensions.largeExtraSize,
                    widget: Center(
                        child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                          Image.asset(
                            CommonAssetsIcons.google,
                            height: ThemeDimensions.sizeTwentyFive,
                            fit: BoxFit.cover,
                          ),
                          const SizedBox(
                            width: ThemeDimensions.sizeFifteen,
                          ),
                          Text(
                            "Google",
                            style: ThemeTextStyles.textMedium,
                          ),
                        ]))),
              ),
              OuteLineBorder(
                height: ThemeDimensions.largeExtraSize,
                widget: Center(
                    child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Image.asset(
                      CommonAssetsIcons.apple,
                      height: ThemeDimensions.sizeTwentyFive,
                      fit: BoxFit.cover,
                    ),
                    Text("Apple", style: ThemeTextStyles.textMedium),
                  ],
                )),
              ),
              Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: ThemeDimensions.sizeTwenty),
                child: Text(
                  "Or",
                  style: ThemeTextStyles.textSemiBold.copyWith(
                      fontSize: ThemeDimensions.fontSizeDefault),
                ),
              ),
              CustomButton(
                radius: ThemeDimensions.radiusBig,
                onPressed: () {
                  Get.offAllNamed(ExampleAppRoutesProvider.routeSignup);
                },
                buttonText: "Sign in with password",
                backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                borderColor: Theme.of(context).colorScheme.surfaceTint,
                height: ThemeDimensions.largeExtraSize,
                width: double.infinity,
              ),

              Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: ThemeDimensions.sizeTwenty),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "Don't have an account ?",
                      style: ThemeTextStyles.textMedium,
                    ),
                    const SizedBox(
                      width: ThemeDimensions.defaultSize,
                    ),
                    Text('Sign up', style: ThemeTextStyles.textSemiBold)
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
