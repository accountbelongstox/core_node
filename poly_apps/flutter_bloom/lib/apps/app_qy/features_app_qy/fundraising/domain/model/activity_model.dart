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

class ActivityModel {
  final String userName;
  final String donated;
  final String userImage;
  ActivityModel(
      {required this.userName, required this.donated, required this.userImage});
}

List<ActivityModel> activityList = [
  ActivityModel(
      userName: "Mohammad", donated: "70",
      userImage: CommonAssetsImages.user1),
  ActivityModel(
      userName: "Jane Cooper", donated: "82",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Robert Hawkins", donated: "63",
      userImage: CommonAssetsImages.user2),
  ActivityModel(
      userName: "Kristan Watson", donated: "90",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Mohammad", donated: "70",
      userImage: CommonAssetsImages.user1),
  ActivityModel(
      userName: "Jane Cooper", donated: "82",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Robert Hawkins", donated: "63",
      userImage: CommonAssetsImages.user2),
  ActivityModel(
      userName: "Kristan Watson", donated: "90",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Mohammad", donated: "70",
      userImage: CommonAssetsImages.user1),
  ActivityModel(
      userName: "Jane Cooper", donated: "82",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Robert Hawkins", donated: "63",
      userImage: CommonAssetsImages.user2),
  ActivityModel(
      userName: "Kristan Watson", donated: "90",
      userImage: CommonAssetsImages.user3)
];
