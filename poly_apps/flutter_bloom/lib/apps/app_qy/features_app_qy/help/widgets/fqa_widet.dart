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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import '../../../resources_app_qy/colors_app_qy.dart';

class FqaWidget extends StatelessWidget {
  final String fqaName;
  const FqaWidget({super.key, required this.fqaName});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          const EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSizeSeven),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultSize),
          border: Border.all(width: 1.5, color: ColorsAppQy.qyBorderLight),
        ),
        child: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                fqaName,
                style: ThemeTextStyles.contentSubtitle,
              ),
              Icon(
                Icons.arrow_drop_down,
                color: Theme.of(context).colorScheme.surfaceTint,
              )
            ],
          ),
        ),
      ),
    );
  }
}
