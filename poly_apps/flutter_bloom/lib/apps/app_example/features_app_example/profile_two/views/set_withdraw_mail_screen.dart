import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/apps/app_example/features_app_example/authentication/views/create_pin_screen.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class WithdrawGmailSetScreen extends StatelessWidget {
  const WithdrawGmailSetScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Withdraw"),
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(
              height: 100,
            ),
            const Center(
                child: Icon(
              Icons.attach_email_rounded,
              size: 100,
              color: Colors.green,
            )),
            const SizedBox(
              height: 100,
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: ThemeDimensions.defaultSize),
              child: Text(
                "   Paypal Email ",
                style: ThemeTextStyles.textSemiBold,
              ),
            ),
            const CustomCircular(
              radius: ThemeDimensions.radiusBig,
              height: 50,
              outlineColor: Colors.green,
              widget: Padding(
                padding:
                    EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
                child: TextField(
                  decoration: InputDecoration(
                      hintText: " paypal email address",
                      suffixIcon: Icon(
                        Icons.email,
                        color: Colors.green,
                      )),
                ),
              ),
            ),
            const Spacer(),
            CustomButton(
              height: ThemeDimensions.paddingSizeOver,
              buttonText: "Continue",
              onPressed: () {
                Get.to((const CreatePinScreen()));
              },
              radius: ThemeDimensions.radiusBig,
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
            )
          ],
        ),
      ),
    );
  }
}
