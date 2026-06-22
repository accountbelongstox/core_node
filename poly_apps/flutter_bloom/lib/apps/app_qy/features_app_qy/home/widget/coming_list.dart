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
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/comingto_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/coming_end_data.dart';

import 'coming_widget.dart';

class ComingListView extends StatelessWidget {
  const ComingListView({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final comingEnds = ComingEndData.getMockComingEnds();
    return SizedBox(
      height: 290,
      child: ListView.builder(
          itemCount: comingEnds.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) {
            final model = comingEnds[index];
            return ComingEndWidget(
              comingEndModel: ComingEndModel(
                days: model.days ?? '',
                percent: model.percent ?? 0.0,
                found: model.found ?? '',
                donat: model.donat ?? '',
                image: model.image ?? '',
                title: model.title ?? '',
              ),
            );
          }),
    );
  }
}
