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

class FundRisingModel {
  String title;
  String details;
  int commentNumber;
  int totalView;
  String thumbnail;

  FundRisingModel(
      {required this.title,
      required this.details,
      required this.commentNumber,
      required this.totalView,
      required this.thumbnail});
}

List<String> typeList = [
  "All",
  "Medical",
  "Education",
  "Fashion",
  "Manicure",
  "Pedicure",
  "Fashion",
  "Entertainment",
  "Sport"
];

List<FundRisingModel> funRisingList = [
  FundRisingModel(
      title: "Hair Cut",
      details:
          "Lorem ipsum dolor sit amet, consecrate disciplining elit, sed do usermod temper incident ut labor et dolore magna aliquot. Ut enum ad minim venial, quits nostrum excitation McCull och labors nisei ut aliquot ex ea commode consequent. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      commentNumber: 10,
      totalView: 1000,
      thumbnail: CommonAssetsImages.baby1),
  FundRisingModel(
      title: "Hair Cut",
      details:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      commentNumber: 10,
      totalView: 1000,
      thumbnail: CommonAssetsImages.education),
  FundRisingModel(
      title: "Hair Cut",
      details:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      commentNumber: 10,
      totalView: 1000,
      thumbnail: CommonAssetsImages.flood),
];
