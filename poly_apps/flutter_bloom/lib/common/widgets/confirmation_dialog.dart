// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:get/get.dart' hide Trans; // Hide GetX's Trans extension
import 'package:qyflutter/common/localization/localization_manager.dart';

class ConfirmationDialog extends StatelessWidget {
  final String icon;
  final String? title;
  final String description;
  final Function onYesPressed;
  final bool isLogOut;
  final Function? onNoPressed;
  final bool fromOpenLocation;
  final bool loading;
  const ConfirmationDialog(
      {super.key,
      required this.icon,
      this.title,
      required this.description,
      required this.onYesPressed,
      this.isLogOut = false,
      this.onNoPressed,
      this.fromOpenLocation = false,
      this.loading = false});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Dialog(
      surfaceTintColor: Theme.of(context).cardColor,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall)),
      insetPadding: const EdgeInsets.all(30),
      clipBehavior: Clip.none,
      backgroundColor: Theme.of(context).canvasColor,
      child: SizedBox(
          width: 500,
          child: Padding(
            padding: const EdgeInsets.all(ThemeDimensions.paddingSizeLarge),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                    top: -70,
                    left: 0,
                    right: 0,
                    child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                              width: 100,
                              height: 100,
                              decoration: BoxDecoration(
                                  color: Theme.of(context).canvasColor,
                                  borderRadius: BorderRadius.circular(100)),
                              child: Padding(
                                  padding: EdgeInsets.all(
                                      ThemeDimensions.paddingSizeOverLarge),
                                  child:
                                      Image.asset(icon, width: 40, height: 40)))
                        ])),
                Padding(
                  padding:
                      EdgeInsets.only(top: ThemeDimensions.paddingSizeOverLarge),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    title != null
                        ? Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: ThemeDimensions.paddingSizeLarge),
                            child: Text(title ?? '',
                                textAlign: TextAlign.center,
                                style: ThemeTextStyles.textMedium.copyWith(
                                    fontSize: ThemeDimensions.fontSizeExtraLarge,
                                    color: Colors.red)))
                        : const SizedBox(),
                    Padding(
                        padding:
                            const EdgeInsets.all(ThemeDimensions.paddingSizeLarge),
                        child: Text(description,
                                                          style: ThemeTextStyles.textMedium.copyWith(
                                  fontSize: ThemeDimensions.fontSizeLarge),
                            textAlign: TextAlign.center)),
                                          const SizedBox(height: ThemeDimensions.paddingSizeLarge),
                    fromOpenLocation
                        ? CustomButton(
                            buttonText: 'open_setting'.tr(context),
                            onPressed: () => onYesPressed(),
                            radius: ThemeDimensions.radiusSmall,
                            height: 40)
                        : loading
                            ? SpinKitCircle(
                                color: Theme.of(context).primaryColor,
                                size: 40.0)
                            : Row(children: [
                                Expanded(
                                    child: TextButton(
                                  onPressed: () => isLogOut
                                      ? onYesPressed()
                                      : onNoPressed != null
                                          ? onNoPressed!()
                                          : Get.back(),
                                  style: TextButton.styleFrom(
                                      backgroundColor: Theme.of(context)
                                          .disabledColor
                                          .withOpacity(0.3),
                                      minimumSize: Size(
                                          ThemeDimensions.webMaxWidth, 40),
                                      padding: EdgeInsets.zero,
                                      shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                              ThemeDimensions.radiusSmall))),
                                  child: Text(
                                      isLogOut
                                          ? 'yes'.tr(context)
                                          : 'no'.tr(context),
                                      textAlign: TextAlign.center,
                                      style: ThemeTextStyles.textBold.copyWith(
                                          color: Theme.of(context)
                                              .textTheme
                                              .bodyMedium!
                                              .color)),
                                )),
                                SizedBox(
                                    width: ThemeDimensions.paddingSizeLarge),
                                Expanded(
                                    child: CustomButton(
                                        buttonText: isLogOut
                                            ? 'no'.tr(context)
                                            : 'yes'.tr(context),
                                        onPressed: () => isLogOut
                                            ? Get.back()
                                            : onYesPressed(),
                                        radius: ThemeDimensions.radiusSmall,
                                        height: 40)),
                              ]),
                  ]),
                ),
              ],
            ),
          )),
    );
  }
}
