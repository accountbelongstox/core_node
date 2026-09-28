import 'package:qyflutter/common/assets/common_assets_images.dart';

class InviteFriendModel {
  final String userImage;
  final String userName;
  final String userNumber;
  InviteFriendModel(
      {required this.userName,
      required this.userNumber,
      required this.userImage});
}

List<InviteFriendModel> inviteFriendModelList = [
  InviteFriendModel(
      userName: 'Jene Cooper ',
      userNumber: "+20-5025-6055",
      userImage: CommonAssetsImages.user1),
  InviteFriendModel(
      userName: 'Cameron Williams',
      userNumber: "+066-283-5980",
      userImage: CommonAssetsImages.user3),
  InviteFriendModel(
      userName: 'Leslie',
      userNumber: "+568-692-556",
      userImage: CommonAssetsImages.user2),
  InviteFriendModel(
      userName: 'Esther Howard ',
      userNumber: "+20-5025-6055",
      userImage: CommonAssetsImages.user1),
  InviteFriendModel(
      userName: 'Savannah Nguyen',
      userNumber: "+066-283-5980",
      userImage: CommonAssetsImages.user3),
  InviteFriendModel(
      userName: 'kristin Watson',
      userNumber: "+568-692-556",
      userImage: CommonAssetsImages.user2),
  InviteFriendModel(
      userName: 'Jene Cooper ',
      userNumber: "+20-5025-6055",
      userImage: CommonAssetsImages.user1),
  InviteFriendModel(
      userName: 'Ralph Edwards',
      userNumber: "+066-283-5980",
      userImage: CommonAssetsImages.user3),
  InviteFriendModel(
      userName: 'Kathryn Murphy',
      userNumber: "+568-692-556",
      userImage: CommonAssetsImages.user2),
];
