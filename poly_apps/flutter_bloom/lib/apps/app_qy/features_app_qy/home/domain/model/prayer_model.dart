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

class PrayerModel {
  final String name;
  final String prayer;
  final String userImage;
  PrayerModel(
      {required this.name, required this.prayer, required this.userImage});
}

List<PrayerModel> prayerList = [
  PrayerModel(
      name: "Prayer",
      userImage: CommonAssetsImages.user1,
      prayer:
          """Hopefully Audrey gen get surgery soon , recover from her illness, and play with her"""),
  PrayerModel(
      name: "User Name",
      userImage: CommonAssetsImages.user3,
      prayer:
          """The victims affected by the flash flood disaster in Surabaya will soon get better and be healthy"""),
  PrayerModel(
      name: "User Name",
      userImage: CommonAssetsImages.user2,
      prayer:
          """Orphan in Africa can get Treatment and nutrition improvement soon..."""),
  PrayerModel(
      name: "Prayer",
      userImage: CommonAssetsImages.user1,
      prayer:
          """Hopefully Audrey gen get surgery soon , recover from her illness, and play with her"""),
  PrayerModel(
      name: "User Name",
      userImage: CommonAssetsImages.user3,
      prayer:
          """The victims affected by the flash flood disaster in Surabaya will soon get better and be healthy"""),
  PrayerModel(
      name: "User Name",
      userImage: CommonAssetsImages.user2,
      prayer:
          """Orphan in Africa can get Treatment and nutrition improvement soon..."""),
  PrayerModel(
      name: "Prayer",
      userImage: CommonAssetsImages.user1,
      prayer:
          """Hopefully Audrey gen get surgery soon , recover from her illness, and play with her"""),
  PrayerModel(
      name: "User Name",
      userImage: CommonAssetsImages.user3,
      prayer:
          """The victims affected by the flash flood disaster in Surabaya will soon get better and be healthy"""),
  PrayerModel(
      name: "User Name",
      userImage: CommonAssetsImages.user2,
      prayer:
          """Orphan in Africa can get Treatment and nutrition improvement soon..."""),
];
