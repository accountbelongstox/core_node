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
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class ResetPasswordView extends StatefulWidget {
  const ResetPasswordView({super.key});
  @override
  State<ResetPasswordView> createState() => _ResetPasswordViewState();
}

class _ResetPasswordViewState extends State<ResetPasswordView> {
  bool? checked = false;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).cardColor,
      appBar: const CustomAppBar(
        title: 'Reset Password',
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeDefault),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Image.asset(
                CommonAssetsIcons.forgotPassword,
                height: ThemeDimensions.identityImageHeight,
                fit: BoxFit.fill,
              ),
            ),
            const Text(
              "Create a new Password",
              style: ThemeTextStyles.textBold,
            ),
            const SizedBox(
              height: ThemeDimensions.mediumSize,
            ),
            const Padding(
              padding: EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
              child: Text(
                "New password",
                style: ThemeTextStyles.textMedium,
              ),
            ),
            const CustomTextField(
              prefixIcon: CommonAssetsIcons.password,
              showBorder: false,
              hintText: "New password",
              isPassword: true,
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Padding(
              padding: EdgeInsets.all(ThemeDimensions.paddingSize),
              child: Text(
                "Confirm password",
                style: ThemeTextStyles.textMedium,
              ),
            ),
            const CustomTextField(
              prefixIcon: CommonAssetsIcons.password,
              showBorder: false,
              hintText: "Confirm password",
              isPassword: true,
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                Checkbox(
                    value: checked,
                    activeColor: Theme.of(context).colorScheme.surfaceTint,
                    focusColor: ThemeColors.grey200,
                    tristate: true,
                    checkColor: ThemeColors.white,
                    onChanged: (newBool) {
                      setState(() {
                        checked = newBool;
                      });
                    }),
                const SizedBox(
                  height: ThemeDimensions.mediumSize,
                ),
                Text('Remember me',
                    style: ThemeTextStyles.textMedium.copyWith(color: ThemeColors.black))
              ],
            ),
            const SizedBox(
              height: ThemeDimensions.sizeTwenty,
            ),
            CustomButton(
              radius: ThemeDimensions.circleLarge,
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
              buttonText: "Save",
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
