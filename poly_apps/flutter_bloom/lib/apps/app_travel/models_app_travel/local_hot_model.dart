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
