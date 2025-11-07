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

part 'grid_nav_model.g.dart';

@JsonSerializable()
class GridNavModel {
  final int id;
  final String title;
  final List<GridNavChildModel> children;

  GridNavModel({
    required this.id,
    required this.title,
    required this.children,
  });

  factory GridNavModel.fromJson(Map<String, dynamic> json) =>
      _$GridNavModelFromJson(json);

  Map<String, dynamic> toJson() => _$GridNavModelToJson(this);

  String getIconPath() {
    return 'assets/apps/app_travel/images/nav/$title@v7.15.png';
  }
}

@JsonSerializable()
class GridNavChildModel {
  final int id;
  final String title;
  final String? subtitle;
  final String? tag;
  final String? hot;
  final String? link;

  GridNavChildModel({
    required this.id,
    required this.title,
    this.subtitle,
    this.tag,
    this.hot,
    this.link,
  });

  factory GridNavChildModel.fromJson(Map<String, dynamic> json) =>
      _$GridNavChildModelFromJson(json);

  Map<String, dynamic> toJson() => _$GridNavChildModelToJson(this);

  bool get hasTag => tag != null && tag!.isNotEmpty;

  bool get hasHot => hot != null && hot!.isNotEmpty;

  bool get hasSubtitle => subtitle != null && subtitle!.isNotEmpty;
}
