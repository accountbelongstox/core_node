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

part 'swiper_item_model.g.dart';

@JsonSerializable()
class SwiperItemModel {
  final int id;
  final String url;
  final String? title;
  final String? link;

  SwiperItemModel({
    required this.id,
    required this.url,
    this.title,
    this.link,
  });

  factory SwiperItemModel.fromJson(Map<String, dynamic> json) =>
      _$SwiperItemModelFromJson(json);

  Map<String, dynamic> toJson() => _$SwiperItemModelToJson(this);

  String getFullImageUrl() {
    if (url.startsWith('http')) {
      return url;
    }
    return 'assets/apps/app_travel/images/$url';
  }
}
