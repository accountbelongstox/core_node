import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import '../../../resources_app_qy/colors_app_qy.dart';

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
                    focusColor: ColorsAppQy.qyBorderLight,
                    tristate: true,
                    checkColor: ColorsAppQy.qyTextOnPrimary,
                    onChanged: (newBool) {
                      setState(() {
                        checked = newBool;
                      });
                    }),
                const SizedBox(
                  height: ThemeDimensions.mediumSize,
                ),
                Text('Remember me',
                    style: ThemeTextStyles.textMedium.copyWith(color: ColorsAppQy.qyTextPrimary))
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
