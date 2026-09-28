import '../models_app_travel/hot_content_model.dart';
import '../models_app_travel/travel_inspiration_model.dart';

/// Test data for journey-related content
/// Following the same pattern as orders_data.dart
class TestJourneyData {
  /// Get test travel inspiration items
  static List<TravelInspirationModel> getTravelInspirations() {
    return [
      TravelInspirationModel(
        id: 'inspiration_001',
        title: '趣玩地图🗺️',
        subtitle: '北京精华景点地图·共43...',
        imageUrl: 'assets/apps/app_travel/images/journey_inspiration_map.png',
        description: '精选北京必游景点，附带详细地图导航',
        category: '地图导览',
        itemCount: 43,
        url: '/map/beijing',
      ),
    ];
  }

  /// Get test hot content items
  static List<HotContentModel> getHotContents() {
    return [
      HotContentModel(
        id: 'hot_001',
        image: 'assets/apps/app_travel/images/hot_content_1.png',
        title: '北京本地人大实话',
        subtitle: '被xhs骗惨了😭终于有人把北京旅游说明白',
        author: '爱旅行',
        likes: 251,
        category: '旅游攻略',
        publishDate: DateTime(2024, 10, 25),
      ),
      HotContentModel(
        id: 'hot_002',
        image: 'assets/apps/app_travel/images/hot_content_2.png',
        title: '北京正确游玩顺序',
        subtitle: '五天四晚 🎈 北京攻略已完善 👍 直接抄',
        author: '旅游小猪',
        likes: 27,
        category: '旅游攻略',
        publishDate: DateTime(2024, 10, 26),
      ),
      HotContentModel(
        id: 'hot_003',
        image: 'assets/apps/app_travel/images/hot_content_3.png',
        title: '刚从北京回来',
        subtitle: '我的建议是 🤔🤔',
        author: '旅行达人',
        likes: 128,
        category: '旅行分享',
        publishDate: DateTime(2024, 10, 28),
      ),
      HotContentModel(
        id: 'hot_004',
        image: 'assets/apps/app_travel/images/hot_content_4.png',
        title: '10.10 北京已回',
        subtitle: '我的建议是。。😭😭',
        author: '旅游分享',
        likes: 89,
        category: '旅行分享',
        publishDate: DateTime(2024, 10, 10),
      ),
    ];
  }

  /// Get hot contents by category
  static List<HotContentModel> getHotContentsByCategory(String category) {
    return getHotContents()
        .where((content) => content.category == category)
        .toList();
  }

  /// Get top N hot contents sorted by likes
  static List<HotContentModel> getTopHotContents({int limit = 10}) {
    final contents = getHotContents();
    contents.sort((a, b) => b.likes.compareTo(a.likes));
    return contents.take(limit).toList();
  }

  /// Search hot contents by keyword
  static List<HotContentModel> searchHotContents(String keyword) {
    if (keyword.isEmpty) return getHotContents();

    final lowerKeyword = keyword.toLowerCase();
    return getHotContents().where((content) {
      return content.title.toLowerCase().contains(lowerKeyword) ||
          content.subtitle.toLowerCase().contains(lowerKeyword) ||
          content.author.toLowerCase().contains(lowerKeyword);
    }).toList();
  }
}
