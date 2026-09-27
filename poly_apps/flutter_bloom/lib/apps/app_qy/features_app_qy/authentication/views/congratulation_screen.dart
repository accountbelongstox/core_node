import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/authentication/views/select_country.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
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
                      color: ColorsAppQy.qyTextOnPrimary,
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
