import 'package:qyflutter/common/assets/common_assets_images.dart';

class WatchImpactModel {
  final String watchName;
  final String watchImage;

  WatchImpactModel({required this.watchImage, required this.watchName});
}

List<WatchImpactModel> watchImpactList = [
  WatchImpactModel(
      watchImage: CommonAssetsImages.baby1, watchName: "watch the child"),
  WatchImpactModel(
      watchImage: CommonAssetsImages.flood, watchName: "watch the child"),
  WatchImpactModel(
      watchImage: CommonAssetsImages.baby3, watchName: "watch the child"),
  WatchImpactModel(
      watchImage: CommonAssetsImages.baby2, watchName: "watch the child"),
];
