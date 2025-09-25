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
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class CustomDropDownItem extends StatelessWidget {
  final String? title;
  final Widget? widget;
  const CustomDropDownItem({super.key, this.title, this.widget});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Padding(
      padding: const EdgeInsets.only(top: ThemeDimensions.paddingSizeExtraSmall),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          title != null
              ? Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.paddingSizeDefault),
                  child: Text(title!.tr(context), style: ThemeTextStyles.textRegular),
                )
              : const SizedBox(),
          Container(
            height: 40,
            padding: const EdgeInsets.symmetric(
                horizontal: ThemeDimensions.paddingSizeSmall),
            decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(50),
                border: Border.all(
                    width: .7,
                    color: Theme.of(context).primaryColor.withOpacity(.25))),
            alignment: Alignment.center,
            child: Center(child: widget),
          ),
          const SizedBox(height: ThemeDimensions.paddingSizeSmall)
        ],
      ),
    );
  }
}
