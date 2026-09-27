import 'package:json_annotation/json_annotation.dart';

part 'popular_item_model.g.dart';

@JsonSerializable()
class PopularItemModel {
  final String title;
  final String img;
  final List<String> list;

  PopularItemModel({
    required this.title,
    required this.img,
    required this.list,
  });

  factory PopularItemModel.fromJson(Map<String, dynamic> json) =>
      _$PopularItemModelFromJson(json);

  Map<String, dynamic> toJson() => _$PopularItemModelToJson(this);

  String getFullImageUrl() {
    if (img.startsWith('http')) {
      return img;
    }
    return 'assets/apps/app_travel/images/$img';
  }
}
