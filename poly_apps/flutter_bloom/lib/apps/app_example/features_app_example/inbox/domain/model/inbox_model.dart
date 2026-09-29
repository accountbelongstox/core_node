import 'package:qyflutter/common/assets/common_assets_images.dart';

class InboxModel {
  final String userImage;
  final String userName;
  final String dateTime;
  final String message;

  InboxModel(
      {required this.userName,
      required this.message,
      required this.dateTime,
      required this.userImage});
}

List<InboxModel> inboxUsersList = [
  InboxModel(
      userName: "Dating",
      message: "I Know a donation..",
      dateTime: "09.10",
      userImage: CommonAssetsImages.user1),
  InboxModel(
      userName: "Arrell Steward",
      message: "Ai Dating App",
      dateTime: "20.25",
      userImage: CommonAssetsImages.user2),
  InboxModel(
      userName: "Jene Cooper",
      message: "This is amazing",
      dateTime: "8.30",
      userImage: CommonAssetsImages.user3),
  InboxModel(
      userName: "Eleanor Pena",
      message: "Ai Dating App",
      dateTime: "05.55",
      userImage: CommonAssetsImages.user1),
  InboxModel(
      userName: "Dating",
      message: "I Know a donation..",
      dateTime: "09.10",
      userImage: CommonAssetsImages.user3),
  InboxModel(
      userName: "Arrell Steward",
      message: "Ai Dating App",
      dateTime: "20.25",
      userImage: CommonAssetsImages.user2),
  InboxModel(
      userName: "Jene Cooper",
      message: "This is amazing",
      dateTime: "8.30",
      userImage: CommonAssetsImages.user1),
  InboxModel(
      userName: "Eleanor Pena",
      message: "Ai Dating App",
      dateTime: "05.55",
      userImage: CommonAssetsImages.user3),
];
