import '../models_app_travel/travel_map_model.dart';

/// 趣玩地图测试数据
class TravelMapData {
  static List<TravelMapModel> getTravelMaps() {
    return [
      const TravelMapModel(
        imagePath: 'assets/apps/app_travel/images/travel_map_1.png',
        title: '皇冠假日度假村',
        subtitle: '爆款酒店 抢先预订',
        userName: '携程口碑榜',
      ),
      const TravelMapModel(
        imagePath: 'assets/apps/app_travel/images/travel_map_2.png',
        title: '塞班岛高档酒店榜',
        subtitle: '盘点超绝体验的4星宝藏酒店',
        userName: '携程口碑榜',
      ),
      const TravelMapModel(
        imagePath: 'assets/apps/app_travel/images/travel_map_3.png',
        title: '塞班岛VS马纳加哈岛',
        subtitle: '谁才是第一度假胜地',
        userName: '瓜行热点·9.4w 人在看',
      ),
      const TravelMapModel(
        imagePath: 'assets/apps/app_travel/images/travel_map_4.png',
        title: 'Saipan 塞班岛拍照',
        subtitle: '海岛太惬意啦',
        userName: '@ 爱学习的喵呀呀 · 531',
      ),
    ];
  }
}
