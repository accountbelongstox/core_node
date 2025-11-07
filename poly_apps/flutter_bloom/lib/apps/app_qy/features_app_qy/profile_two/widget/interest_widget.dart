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
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class InterestWidget extends StatelessWidget {
  final String interest;
  const InterestWidget({super.key, required this.interest});

  @override
  Widget build(BuildContext context) {
    return CustomCircular(
      outlineColor: ThemeColors.green,
      radius: ThemeDimensions.radiusBig,
      widget: Padding(
        padding: const EdgeInsets.symmetric(
            vertical: ThemeDimensions.paddingSizeExtraSmall,
            horizontal: ThemeDimensions.defaultSize),
        child: Text(
          interest,
          style: ThemeTextStyles.textMedium.copyWith(
              color: Colors.green, fontSize: ThemeDimensions.fontSizeDefault),
        ),
      ),
    );
  }
}
