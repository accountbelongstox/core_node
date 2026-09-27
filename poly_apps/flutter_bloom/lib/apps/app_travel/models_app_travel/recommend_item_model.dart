import 'package:json_annotation/json_annotation.dart';

part 'recommend_item_model.g.dart';

@JsonSerializable()
class RecommendItemModel {
  final String? title;
  final String img;
  final String? tag;
  final String? sight;
  final String? about;
  final String? link;

  RecommendItemModel({
    this.title,
    required this.img,
    this.tag,
    this.sight,
    this.about,
    this.link,
  });

  factory RecommendItemModel.fromJson(Map<String, dynamic> json) =>
      _$RecommendItemModelFromJson(json);

  Map<String, dynamic> toJson() => _$RecommendItemModelToJson(this);

  String getFullImageUrl() {
    if (img.startsWith('http')) {
      return img;
    }
    return 'assets/apps/app_travel/images/$img';
  }

  String getDisplayTitle() {
    return title ?? sight ?? '';
  }

  bool get hasTag => tag != null && tag!.isNotEmpty;

  bool get hasSight => sight != null && sight!.isNotEmpty;
}
