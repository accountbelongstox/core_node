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

class InviteFriendModel {
  final String userImage;
  final String userName;
  final String userNumber;
  InviteFriendModel(
      {required this.userName,
      required this.userNumber,
      required this.userImage});
}

List<InviteFriendModel> inviteFriendModelList = [
  InviteFriendModel(
      userName: 'Jene Cooper ',
      userNumber: "+20-5025-6055",
      userImage: CommonAssetsImages.user1),
  InviteFriendModel(
      userName: 'Cameron Williams',
      userNumber: "+066-283-5980",
      userImage: CommonAssetsImages.user3),
  InviteFriendModel(
      userName: 'Leslie',
      userNumber: "+568-692-556",
      userImage: CommonAssetsImages.user2),
  InviteFriendModel(
      userName: 'Esther Howard ',
      userNumber: "+20-5025-6055",
      userImage: CommonAssetsImages.user1),
  InviteFriendModel(
      userName: 'Savannah Nguyen',
      userNumber: "+066-283-5980",
      userImage: CommonAssetsImages.user3),
  InviteFriendModel(
      userName: 'kristin Watson',
      userNumber: "+568-692-556",
      userImage: CommonAssetsImages.user2),
  InviteFriendModel(
      userName: 'Jene Cooper ',
      userNumber: "+20-5025-6055",
      userImage: CommonAssetsImages.user1),
  InviteFriendModel(
      userName: 'Ralph Edwards',
      userNumber: "+066-283-5980",
      userImage: CommonAssetsImages.user3),
  InviteFriendModel(
      userName: 'Kathryn Murphy',
      userNumber: "+568-692-556",
      userImage: CommonAssetsImages.user2),
];
