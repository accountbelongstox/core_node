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
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/apps/app_example/features_app_example/help/widgets/fqa_widet.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class FqaScreenView extends StatelessWidget {
  const FqaScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Text(
            'Faq',
            style: ThemeTextStyles.appNavigation,
          ),
        ),
        body: const Padding(
          padding: EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Column(
            children: [
              UrgentFundRisingWidget(),
              FqaWidget(
                fqaName: "How to use wecare ?",
              ),
              FqaWidget(fqaName: "Can I create my own fundraising ?"),
              FqaWidget(
                fqaName: "How to top up balance on wecare ?",
              ),
              FqaWidget(
                fqaName: "How to withdraw on balance on wecare ?",
              ),
              FqaWidget(fqaName: "Is there a free tips to use this app"),
              FqaWidget(fqaName: "Is Wecare free to use?"),
              FqaWidget(fqaName: "How to make offer on Wecare ?")
            ],
          ),
        ));
  }
}
