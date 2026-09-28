import 'package:qyflutter/common/assets/common_assets_images.dart';

class ActivityModel {
  final String userName;
  final String donated;
  final String userImage;
  ActivityModel(
      {required this.userName, required this.donated, required this.userImage});
}

List<ActivityModel> activityList = [
  ActivityModel(
      userName: "Mohammad", donated: "70",
      userImage: CommonAssetsImages.user1),
  ActivityModel(
      userName: "Jane Cooper", donated: "82",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Robert Hawkins", donated: "63",
      userImage: CommonAssetsImages.user2),
  ActivityModel(
      userName: "Kristan Watson", donated: "90",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Mohammad", donated: "70",
      userImage: CommonAssetsImages.user1),
  ActivityModel(
      userName: "Jane Cooper", donated: "82",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Robert Hawkins", donated: "63",
      userImage: CommonAssetsImages.user2),
  ActivityModel(
      userName: "Kristan Watson", donated: "90",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Mohammad", donated: "70",
      userImage: CommonAssetsImages.user1),
  ActivityModel(
      userName: "Jane Cooper", donated: "82",
      userImage: CommonAssetsImages.user3),
  ActivityModel(
      userName: "Robert Hawkins", donated: "63",
      userImage: CommonAssetsImages.user2),
  ActivityModel(
      userName: "Kristan Watson", donated: "90",
      userImage: CommonAssetsImages.user3)
];
