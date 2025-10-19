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

class DonationModel {
  final String? title;
  final String? image;
  final String? donators;
  final String? found;
  final String? days;

  DonationModel({this.title, this.days, this.donators, this.image, this.found});
}

List<DonationModel> donationModelList = [
  DonationModel(
    days: "1",
    found: "8,586",
    donators: "396",
    image: CommonAssetsImages.child6,
    title: "Donate to Help Children and Refugees",
  ),
  DonationModel(
    days: "3",
    found: "3,638",
    donators: "258",
    image: CommonAssetsImages.child2,
    title: "Stand ready to respond swiftly and effectively",
  ),
  DonationModel(
    days: "2",
    found: "1,425",
    donators: "460",
    image: CommonAssetsImages.helpChild,
    title: "We offer a wide range of programs",
  ),
  DonationModel(
    days: "5",
    found: "7,425",
    donators: "182",
    image: CommonAssetsImages.child3,
    title: "leading the massive humanitarian effort",
  ),
];
