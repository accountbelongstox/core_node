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
