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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class CustomTitle extends StatelessWidget {
  final String title;
  final bool isFiler;
  final Color? color;

  final Function()? onTap;
  const CustomTitle({
    super.key,
    required this.title,
    this.isFiler = false,
    this.onTap,
    this.color,
  });
  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          ThemeDimensions.paddingSizeDefault,
          ThemeDimensions.paddingSizeDefault,
          ThemeDimensions.paddingSizeDefault,
          ThemeDimensions.paddingSizeSmall),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title.tr(context),
              style: ThemeTextStyles.textSemiBold.copyWith(
                  fontSize: ThemeDimensions.fontSizeExtraLarge,
                  color:
                      color ?? Theme.of(context).textTheme.bodyLarge!.color)),
          Row(
            children: [
              Text(
                "see_all".tr(context),
                style: ThemeTextStyles.textRegular.copyWith(
                  fontSize: ThemeDimensions.fontSizeDefault,
                ),
              ),
              Icon(Icons.arrow_forward_ios_rounded,
                  size: 15, color: Theme.of(context).hintColor),
            ],
          ),
          if (isFiler)
            GestureDetector(
              onTap: onTap,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingSizeSmall,
                    vertical: ThemeDimensions.paddingSizeExtraSmall),
                decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(
                        width: .25, color: Theme.of(context).primaryColor)),
                child: Row(
                  children: [
                    SizedBox(
                        width: ThemeDimensions.iconSizeSmall,
                        child: Image.asset(CommonAssetsIcons.filterVerticalIcon)),
                    const SizedBox(width: ThemeDimensions.paddingSizeExtraSmall),
                    Text('filter_date'.tr(context))
                  ],
                ),
              ),
            )
        ],
      ),
    );
  }
}
