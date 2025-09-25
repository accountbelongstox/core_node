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

class TypeButtonWidget extends StatelessWidget {
  final int index;
  final String name;
  final Function()? onTap;
  final int selectedIndex;
  final double? cardWidth;
  const TypeButtonWidget(
      {super.key,
      required this.index,
      required this.name,
      this.onTap,
      required this.selectedIndex,
      this.cardWidth});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeExtraSmall),
        child: Container(
          width: cardWidth ?? MediaQuery.of(context).size.width / 2.5,
          padding: const EdgeInsets.all(ThemeDimensions.paddingSizeSmall),
          decoration: BoxDecoration(
            border: Border.all(
                width: .5,
                color: index == selectedIndex
                    ? Theme.of(context).colorScheme.onSecondary
                    : Theme.of(context).primaryColor),
            color: index == selectedIndex
                ? Theme.of(context).primaryColor
                : Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(ThemeDimensions.paddingSizeSmall),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 5),
                child: Text(name.tr(context),
                    textAlign: TextAlign.center,
                    style: ThemeTextStyles.textSemiBold.copyWith(
                        color: index == selectedIndex
                            ? Colors.white
                            : Theme.of(context).hintColor.withOpacity(.65),
                        fontSize: ThemeDimensions.fontSizeLarge)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
