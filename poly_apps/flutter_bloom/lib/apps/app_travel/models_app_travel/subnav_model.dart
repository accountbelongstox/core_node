import 'package:json_annotation/json_annotation.dart';

part 'subnav_model.g.dart';

@JsonSerializable()
class SubnavModel {
  final int id;
  final String title;
  final String? icon;
  final String? link;

  SubnavModel({
    required this.id,
    required this.title,
    this.icon,
    this.link,
  });

  factory SubnavModel.fromJson(Map<String, dynamic> json) =>
      _$SubnavModelFromJson(json);

  Map<String, dynamic> toJson() => _$SubnavModelToJson(this);
}
