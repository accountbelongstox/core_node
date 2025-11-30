// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:json_annotation/json_annotation.dart';

part 'local_hot_model.g.dart';

@JsonSerializable()
class LocalHotModel {
  final int id;
  final String title;
  final String img;
  final String? link;

  LocalHotModel({
    required this.id,
    required this.title,
    required this.img,
    this.link,
  });

  factory LocalHotModel.fromJson(Map<String, dynamic> json) =>
      _$LocalHotModelFromJson(json);

  Map<String, dynamic> toJson() => _$LocalHotModelToJson(this);

  String getFullImageUrl() {
    if (img.startsWith('http')) {
      return img;
    }
    return 'assets/apps/app_travel/images/$img';
  }
}
