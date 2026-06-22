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

class UrgentFundingModel {
  final String? title;
  final String? image;
  final String? found;
  final String? donators;
  final String? days;

  UrgentFundingModel({
    this.found,
    this.title,
    this.days,
    this.donators,
    this.image,
  });
}

List<UrgentFundingModel> urgentModelList = [
  UrgentFundingModel(
    days: "2",
    found: "25.165",
    donators: "5,2251",
    image: CommonAssetsImages.urgent1,
    title: "Health in Mind is a service ",
  ),
  UrgentFundingModel(
    days: "5",
    found: "4,258",
    donators: "22251",
    image: CommonAssetsImages.urgent3,
    title: "Urgent help is needed if a person ",
  ),
  UrgentFundingModel(
    days: "4",
    found: "5,8364",
    donators: "2,2251",
    image: CommonAssetsImages.urgent2,
    title: "Harm themselves or others, or to end ",
  ),
  UrgentFundingModel(
    days: "9",
    found: "4,6444",
    donators: "5875",
    image: CommonAssetsImages.urgent4,
    title: "Urgent help can be accessed",
  ),
  UrgentFundingModel(
    days: "3",
    found: "29,045",
    donators: "14851",
    image: CommonAssetsImages.urgent5,
    title: "Depression which can be caused ",
  ),
];
