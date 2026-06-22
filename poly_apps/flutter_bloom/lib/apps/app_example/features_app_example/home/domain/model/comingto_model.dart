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

import 'package:qyflutter/common/assets/common_assets_images.dart';

class ComingEndModel {
  final double? percent;
  final String? title;
  final String? image;
  final String? found;
  final String? donat;
  final String? days;

  ComingEndModel(
      {this.title,
      this.days,
      this.donat,
      this.image,
      this.found,
      this.percent});
}

List<ComingEndModel> comingModelList = [
  ComingEndModel(
    days: "11",
    percent: 0.9,
    found: "8,928",
    donat: "44.366",
    image: CommonAssetsImages.poor6,
    title: "Poverty is a complex issue that stems",
  ),
  ComingEndModel(
    days: "6",
    percent: 0.5,
    found: "3,250",
    donat: "58,255",
    image: CommonAssetsImages.poor1,
    title: "children are disproportionately affected ",
  ),
  ComingEndModel(
    days: "2",
    percent: 0.7,
    found: "6,928",
    donat: "25.202",
    image: CommonAssetsImages.poor4,
    title: "may not have access to adequate ",
  ),
  //ComingEndModel(days: "4",found: "12,250", donat:"61,158",image: CommonAssetsIcons.poor5,title: "someone may be considered underprivileged", ),
  ComingEndModel(
    days: "9",
    percent: 0.3,
    found: "5,928",
    donat: "97,18",
    image: CommonAssetsImages.poor3,
    title: "necessities such as food, shelter",
  ),
  ComingEndModel(
    days: "3",
    percent: 0.6,
    found: "10,250",
    donat: "35,971",
    image: CommonAssetsImages.poor6,
    title: "other services and equipment ",
  ),
];
