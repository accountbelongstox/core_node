import 'package:qyflutter/common/assets/common_assets_icons.dart';

class InterestModel {
  final String title;
  final String image;
  InterestModel({required this.title, required this.image});
}

List<InterestModel> interestList = [
  InterestModel(title: "Educations", image: CommonAssetsIcons.education),
  InterestModel(title: "Inventory", image: CommonAssetsIcons.inventor),
  InterestModel(title: "Social", image: CommonAssetsIcons.social),
  InterestModel(title: "Art", image: CommonAssetsIcons.art),
  InterestModel(title: "Health", image: CommonAssetsIcons.health),
  InterestModel(title: "Hospital", image: CommonAssetsIcons.city),
  InterestModel(title: "Sick Baby", image: CommonAssetsIcons.baby),
  InterestModel(title: "People", image: CommonAssetsIcons.people),
  InterestModel(title: "Social", image: CommonAssetsIcons.social),
  InterestModel(title: "Others", image: CommonAssetsIcons.menu),
];
