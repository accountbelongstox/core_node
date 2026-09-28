import 'package:qyflutter/common/assets/common_assets_images.dart';

class FundRisingModel {
  String title;
  String details;
  int commentNumber;
  int totalView;
  String thumbnail;

  FundRisingModel(
      {required this.title,
      required this.details,
      required this.commentNumber,
      required this.totalView,
      required this.thumbnail});
}

List<String> typeList = [
  "All",
  "Medical",
  "Education",
  "Fashion",
  "Manicure",
  "Pedicure",
  "Fashion",
  "Entertainment",
  "Sport"
];

List<FundRisingModel> funRisingList = [
  FundRisingModel(
      title: "Hair Cut",
      details:
          "Lorem ipsum dolor sit amet, consecrate disciplining elit, sed do usermod temper incident ut labor et dolore magna aliquot. Ut enum ad minim venial, quits nostrum excitation McCull och labors nisei ut aliquot ex ea commode consequent. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      commentNumber: 10,
      totalView: 1000,
      thumbnail: CommonAssetsImages.baby1),
  FundRisingModel(
      title: "Hair Cut",
      details:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      commentNumber: 10,
      totalView: 1000,
      thumbnail: CommonAssetsImages.education),
  FundRisingModel(
      title: "Hair Cut",
      details:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      commentNumber: 10,
      totalView: 1000,
      thumbnail: CommonAssetsImages.flood),
];
