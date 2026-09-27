import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';
import 'package:pin_code_fields/pin_code_fields.dart';

class CreatePinScreen extends StatelessWidget {
  const CreatePinScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(
        title: "Create Your Pin",
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Text(
              "Please remember this PIN Because it will be word when you want to top up whit draw , or donute.",
              style: ThemeTextStyles.textMedium,
            ),
            const SizedBox(
              height: ThemeDimensions.bigMediumSize,
            ),
            const Text("Create PIN", style: ThemeTextStyles.textSemiBold),
            Center(
              child: PinCodeTextField(
                  appContext: context, length: 6, pinTheme: PinTheme()),
            ),
            const Spacer(),
            CustomButton(
              onPressed: () {
                Get.toNamed(QyAppRoutesProvider.routeHome);
              },
              radius: ThemeDimensions.radiusBig,
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
              borderColor: Theme.of(context).colorScheme.surfaceTint,
              height: ThemeDimensions.largeExtraSize,
              width: double.infinity,
              buttonText: "Create PIN",
            ),
          ],
        ),
      ),
    );
  }
}
