import 'order_detail_model.dart';

/// 订单详情测试数据
class OrderDetailTestData {
  /// 获取推荐酒店列表
  static List<HotelRecommendation> getHotelRecommendations() {
    return [
      HotelRecommendation(
        name: '绿洲精品屋酒店',
        imageUrl: 'assets/apps/app_travel/images/hotel_recommend_1.png',
        rating: 4.5,
        ratingText: '很好',
        price: 424,
        totalPrice: '含税/费总价 ¥487',
        distanceInMeters: 560,
      ),
      HotelRecommendation(
        name: '白雪公主城堡酒店',
        imageUrl: 'assets/apps/app_travel/images/hotel_recommend_2.png',
        rating: 5.0,
        ratingText: '超棒',
        price: 478,
        totalPrice: null,
        distanceInMeters: 430,
      ),
      HotelRecommendation(
        name: '塞班皇冠假日度假村',
        imageUrl: 'assets/apps/app_travel/images/hotel_recommend_3.png',
        rating: 4.6,
        ratingText: '很好',
        price: 1194,
        totalPrice: '含税/费总价 ¥1137',
        distanceInMeters: 3000,
      ),
    ];
  }
}
