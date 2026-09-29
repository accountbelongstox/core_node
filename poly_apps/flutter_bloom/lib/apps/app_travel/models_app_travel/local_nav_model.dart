import 'package:json_annotation/json_annotation.dart';

part 'local_nav_model.g.dart';

@JsonSerializable()
class LocalNavModel {
  final int id;
  final String title;
  final String? icon;
  final String? link;

  LocalNavModel({
    required this.id,
    required this.title,
    this.icon,
    this.link,
  });

  factory LocalNavModel.fromJson(Map<String, dynamic> json) =>
      _$LocalNavModelFromJson(json);

  Map<String, dynamic> toJson() => _$LocalNavModelToJson(this);
}
