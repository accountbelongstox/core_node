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
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:go_router/go_router.dart';

class DigitalPaymentDialog extends StatelessWidget {
  final bool isFailed;
  final double rotateAngle;
  final IconData icon;
  final String? title;
  final String? description;
  const DigitalPaymentDialog(
      {super.key,
      this.isFailed = false,
      this.rotateAngle = 0,
      required this.icon,
      required this.title,
      required this.description});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeLarge),
        child: Stack(clipBehavior: Clip.none, children: [
          Positioned(
            left: 0,
            right: 0,
            top: -55,
            child: Container(
              height: 80,
              width: 80,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                  color: isFailed
                      ? Theme.of(context).colorScheme.error
                      : Theme.of(context).primaryColor,
                  shape: BoxShape.circle),
              child: Transform.rotate(
                  angle: rotateAngle,
                  child: Icon(icon, size: 40, color: Colors.white)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 40),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(title!.tr(context),
                  style: ThemeTextStyles.textBold.copyWith(fontSize: ThemeDimensions.fontSizeLarge)),
              const SizedBox(height: ThemeDimensions.paddingSizeSmall),
              Text(description!.tr(context),
                  textAlign: TextAlign.center, style: ThemeTextStyles.textRegular),
              const SizedBox(height: ThemeDimensions.paddingSizeLarge),
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingSizeLarge),
                child: CustomButton(
                    buttonText: 'ok'.tr(context),
                    onPressed: () => context.pop()),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
