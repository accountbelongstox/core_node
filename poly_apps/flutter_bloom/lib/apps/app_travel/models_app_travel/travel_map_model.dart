/// 趣玩地图模型
class TravelMapModel {
  final String imagePath;
  final String title;
  final String subtitle;
  final String userName;
  final String userAvatar;

  const TravelMapModel({
    required this.imagePath,
    required this.title,
    required this.subtitle,
    required this.userName,
    this.userAvatar = '',
  });
}
