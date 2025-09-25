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
import 'package:qyflutter/apps/app_example/features_app_example/help/model/help_data_model.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class TermsEndConditionScreenView extends StatelessWidget {
  const TermsEndConditionScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Terms End Condition",
          style: ThemeTextStyles.title1,
        ),
      ),
      body: SingleChildScrollView(
        scrollDirection: Axis.vertical,
        child: Padding(
          padding: ThemeDimensions.paddingM,
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  "Terms End Condition",
                  style: ThemeTextStyles.title2Bold,
                ),
                SizedBox(
                  height: ThemeDimensions.spacing16,
                ),
                Text(
                  introduction,
                  style: ThemeTextStyles.body.copyWith(letterSpacing: 1.3),
                ),
                SizedBox(
                  height: ThemeDimensions.spacing20,
                ),
                Text(
                  'Accessing the service',
                  style: ThemeTextStyles.title3Bold,
                ),
                SizedBox(
                  height: ThemeDimensions.spacing16,
                ),
                Text(
                  accessing,
                  style: ThemeTextStyles.body.copyWith(letterSpacing: 1.3),
                ),
                SizedBox(
                  height: ThemeDimensions.spacing16,
                ),
              ]),
        ),
      ),
    );
  }
}
