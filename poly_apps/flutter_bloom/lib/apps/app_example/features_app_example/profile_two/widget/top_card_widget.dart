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

class FollowerCardWidget extends StatelessWidget {
  final String followers;
  const FollowerCardWidget({super.key, required this.followers});

  @override
  Widget build(BuildContext context) {
    return CustomCircular(
      radius: ThemeDimensions.defaultSize,
      outlineColor: Theme.of(context).hoverColor,
      widget: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.sizeFifteen),
        child: Column(
          children: [
            Text(
              followers,
              style: ThemeTextStyles.contentSubtitle,
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Text(
              "Followers",
              style: ThemeTextStyles.contentDetail,
            ),
          ],
        ),
      ),
    );
  }
}
