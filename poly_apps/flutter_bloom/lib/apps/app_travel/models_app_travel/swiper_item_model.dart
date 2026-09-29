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
