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
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/urgetnt_fundrasing_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'urgentfunding_widget.dart';

class FundRisingListView extends StatelessWidget {
  const FundRisingListView({super.key});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return SizedBox(
      height: ThemeDimensions.onePointFiveWidth,
      child: ListView.builder(
          itemCount: urgentModelList.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) => UrgentFundraisingScreen(
              urgentFundingModel: urgentModelList[index])),
    );
  }
}
