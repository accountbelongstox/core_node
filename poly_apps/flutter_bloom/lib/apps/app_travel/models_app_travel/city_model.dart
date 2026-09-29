import 'package:json_annotation/json_annotation.dart';

part 'city_model.g.dart';

@JsonSerializable()
class CityModel {
  final int id;
  final String spell;
  final String name;

  CityModel({
    required this.id,
    required this.spell,
    required this.name,
  });

  factory CityModel.fromJson(Map<String, dynamic> json) =>
      _$CityModelFromJson(json);

  Map<String, dynamic> toJson() => _$CityModelToJson(this);

  String get firstLetter => spell.isNotEmpty ? spell[0].toUpperCase() : '';
}

@JsonSerializable()
class CityDataResponse {
  final int code;
  final CityData data;

  CityDataResponse({
    required this.code,
    required this.data,
  });

  factory CityDataResponse.fromJson(Map<String, dynamic> json) =>
      _$CityDataResponseFromJson(json);

  Map<String, dynamic> toJson() => _$CityDataResponseToJson(this);

  bool get isSuccess => code == 0;
}

@JsonSerializable()
class CityData {
  final List<CityModel> hotCities;
  final Map<String, List<CityModel>> cities;

  CityData({
    required this.hotCities,
    required this.cities,
  });

  factory CityData.fromJson(Map<String, dynamic> json) =>
      _$CityDataFromJson(json);

  Map<String, dynamic> toJson() => _$CityDataToJson(this);

  List<String> getLetters() {
    List<String> letters = cities.keys.toList();
    letters.sort();
    return letters;
  }

  List<CityModel> getCitiesByLetter(String letter) {
    return cities[letter] ?? [];
  }

  static CityData empty() {
    return CityData(
      hotCities: [],
      cities: {},
    );
  }
}
