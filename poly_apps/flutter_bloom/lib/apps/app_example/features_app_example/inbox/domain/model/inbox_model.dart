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

class InboxModel {
  final String userImage;
  final String userName;
  final String dateTime;
  final String message;

  InboxModel(
      {required this.userName,
      required this.message,
      required this.dateTime,
      required this.userImage});
}

List<InboxModel> inboxUsersList = [
  InboxModel(
      userName: "Dating",
      message: "I Know a donation..",
      dateTime: "09.10",
      userImage: CommonAssetsImages.user1),
  InboxModel(
      userName: "Arrell Steward",
      message: "Ai Dating App",
      dateTime: "20.25",
      userImage: CommonAssetsImages.user2),
  InboxModel(
      userName: "Jene Cooper",
      message: "This is amazing",
      dateTime: "8.30",
      userImage: CommonAssetsImages.user3),
  InboxModel(
      userName: "Eleanor Pena",
      message: "Ai Dating App",
      dateTime: "05.55",
      userImage: CommonAssetsImages.user1),
  InboxModel(
      userName: "Dating",
      message: "I Know a donation..",
      dateTime: "09.10",
      userImage: CommonAssetsImages.user3),
  InboxModel(
      userName: "Arrell Steward",
      message: "Ai Dating App",
      dateTime: "20.25",
      userImage: CommonAssetsImages.user2),
  InboxModel(
      userName: "Jene Cooper",
      message: "This is amazing",
      dateTime: "8.30",
      userImage: CommonAssetsImages.user1),
  InboxModel(
      userName: "Eleanor Pena",
      message: "Ai Dating App",
      dateTime: "05.55",
      userImage: CommonAssetsImages.user3),
];
