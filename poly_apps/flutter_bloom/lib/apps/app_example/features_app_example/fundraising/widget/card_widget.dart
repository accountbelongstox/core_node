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
import 'package:qyflutter/common/assets/common_assets_icons.dart';

class FundaisingSubImageWidget extends StatelessWidget {
  const FundaisingSubImageWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
        height: 100,
        width: 120,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
        ),
        child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: const Image(
              image: AssetImage(
                CommonAssetsIcons.education,
              ),
              fit: BoxFit.cover,
            )));
  }
}
