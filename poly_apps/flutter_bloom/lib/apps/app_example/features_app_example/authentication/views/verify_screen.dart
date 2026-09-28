import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
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
                Get.offAllNamed(ExampleAppRoutesProvider.routeReset);
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
