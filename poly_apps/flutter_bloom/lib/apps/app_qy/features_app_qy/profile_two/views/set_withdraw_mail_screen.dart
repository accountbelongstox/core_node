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
import 'package:qyflutter/apps/app_qy/features_app_qy/authentication/views/create_pin_screen.dart';
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
