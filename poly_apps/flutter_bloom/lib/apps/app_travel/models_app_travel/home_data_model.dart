import 'package:json_annotation/json_annotation.dart';
import 'swiper_item_model.dart';
import 'local_nav_model.dart';
import 'grid_nav_model.dart';
import 'subnav_model.dart';
import 'popular_item_model.dart';
import 'recommend_item_model.dart';
import 'local_hot_model.dart';
import 'sight_model.dart';

part 'home_data_model.g.dart';

@JsonSerializable()
class HomeDataResponse {
  final int code;
  final HomeData data;

  HomeDataResponse({
    required this.code,
    required this.data,
  });

  factory HomeDataResponse.fromJson(Map<String, dynamic> json) =>
      _$HomeDataResponseFromJson(json);

  Map<String, dynamic> toJson() => _$HomeDataResponseToJson(this);

  bool get isSuccess => code == 0;
}

@JsonSerializable()
class HomeData {
  final List<SwiperItemModel> swipeImages;
  final List<LocalNavModel> localNavs;
  final List<GridNavModel> gridNavs;
  final List<SubnavModel> subnavs;
  final List<PopularItemModel> popularList;
  final List<List<RecommendItemModel>> recommend;
  final List<LocalHotModel> localHot;
  final List<SightModel>? sights;

  HomeData({
    required this.swipeImages,
    required this.localNavs,
    required this.gridNavs,
    required this.subnavs,
    required this.popularList,
    required this.recommend,
    required this.localHot,
    this.sights,
  });

  factory HomeData.fromJson(Map<String, dynamic> json) =>
      _$HomeDataFromJson(json);

  Map<String, dynamic> toJson() => _$HomeDataToJson(this);

  static HomeData empty() {
    return HomeData(
      swipeImages: [],
      localNavs: [],
      gridNavs: [],
      subnavs: [],
      popularList: [],
      recommend: [],
      localHot: [],
      sights: [],
    );
  }
}
