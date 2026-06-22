import 'package:json_annotation/json_annotation.dart';

part 'sight_model.g.dart';

@JsonSerializable()
class SightModel {
  final int id;
  final String name;
  final List<String> shortFeatures;
  final String sightCategoryInfo;
  final double price;
  final String distanceStr;
  final String imgUrl;

  SightModel({
    required this.id,
    required this.name,
    required this.shortFeatures,
    required this.sightCategoryInfo,
    required this.price,
    required this.distanceStr,
    required this.imgUrl,
  });

  factory SightModel.fromJson(Map<String, dynamic> json) =>
      _$SightModelFromJson(json);

  Map<String, dynamic> toJson() => _$SightModelToJson(this);

  String getFullImageUrl() {
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      return imgUrl;
    }
    return 'assets/apps/app_travel/images/$imgUrl';
  }
}
