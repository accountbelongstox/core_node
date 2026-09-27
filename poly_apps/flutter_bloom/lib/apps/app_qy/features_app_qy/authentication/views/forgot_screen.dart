import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/authentication/views/verify_screen.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class ForgotScreenView extends StatelessWidget {
  const ForgotScreenView({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        backgroundColor: Theme.of(context).cardColor,
        body: Column(
          children: [
            const CustomAppBar(
              regularAppbar: true,
              title: "Forgot Password",
            ),
            Image.asset(CommonAssetsIcons.forgotPassword,
                height: ThemeDimensions.bigExtraSize),
            const Padding(
              padding: EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
              child: Text(
                "Select which contact details should we send to rested your password",
                style: ThemeTextStyles.textMedium,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingSizeDefault),
              child: OuteLineBorder(
                height: ThemeDimensions.bigSize,
                outlineColor: Theme.of(context).colorScheme.tertiary,
                widget: Padding(
                  padding: const EdgeInsets.all(ThemeDimensions.paddingSize),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: ThemeDimensions.circleMedium,
                        backgroundColor:
                            Theme.of(context).colorScheme.onTertiary,
                        child: Icon(
                          Icons.sms,
                          color: Theme.of(context).colorScheme.surfaceTint,
                        ),
                      ),
                      const SizedBox(
                        width: ThemeDimensions.sizeTwenty,
                      ),
                      const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "via SMS",
                            style: ThemeTextStyles.textMedium,
                          ),
                          Text(
                            "***23645***19",
                            style: ThemeTextStyles.textBold,
                          )
                        ],
                      )
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.sizeTwenty,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingSizeDefault),
              child: OuteLineBorder(
                height: ThemeDimensions.bigSize,
                outlineColor: Theme.of(context).colorScheme.surfaceTint,
                widget: Padding(
                  padding: const EdgeInsets.all(ThemeDimensions.paddingSize),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: ThemeDimensions.circleMedium,
                        backgroundColor:
                            Theme.of(context).colorScheme.onTertiary,
                        child: Icon(
                          Icons.email,
                          color: Theme.of(context).colorScheme.surfaceTint,
                        ),
                      ),
                      const SizedBox(
                        width: ThemeDimensions.sizeTwenty,
                      ),
                      const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "via Email",
                            style: ThemeTextStyles.textMedium,
                          ),
                          Text(
                            "***2364519@gmail.com",
                            style: ThemeTextStyles.textBold,
                          )
                        ],
                      )
                    ],
                  ),
                ),
              ),
            ),
            Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.paddingSizeDefault),
                child: CustomButton(
                  radius: ThemeDimensions.radiusBig,
                  height: ThemeDimensions.bottomMedium,
                  width: double.infinity,
                  onPressed: () {
                    Get.to(const VerifyScreenView());
                  },
                  backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                  buttonText: "Continue",
                )),
          ],
        ));
  }
}
