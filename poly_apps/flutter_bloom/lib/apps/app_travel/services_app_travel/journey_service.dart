import '../models_app_travel/hot_content_model.dart';
import '../models_app_travel/travel_inspiration_model.dart';
import '../models_app_travel/order_model.dart';
import '../models_app_travel/itinerary_model.dart';
import '../testdata/journey_data.dart';
import '../testdata/orders_data.dart';

/// Service for managing journey-related data and business logic
class JourneyService {
  /// Get all travel inspirations
  Future<List<TravelInspirationModel>> fetchTravelInspirations() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return TestJourneyData.getTravelInspirations();
  }

  /// Get all hot contents
  Future<List<HotContentModel>> fetchHotContents() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return TestJourneyData.getHotContents();
  }

  /// Get hot contents by category
  Future<List<HotContentModel>> fetchHotContentsByCategory(
      String category) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return TestJourneyData.getHotContentsByCategory(category);
  }

  /// Get top hot contents
  Future<List<HotContentModel>> fetchTopHotContents({int limit = 10}) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return TestJourneyData.getTopHotContents(limit: limit);
  }

  /// Search hot contents
  Future<List<HotContentModel>> searchHotContents(String keyword) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return TestJourneyData.searchHotContents(keyword);
  }

  /// Like a hot content
  Future<bool> likeHotContent(String contentId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return true;
  }

  /// Unlike a hot content
  Future<bool> unlikeHotContent(String contentId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return true;
  }

  /// Get daily itinerary from orders
  Future<List<DailyItineraryModel>> fetchDailyItinerary() async {
    await Future.delayed(const Duration(milliseconds: 300));

    final orders = TestOrdersData.getTestOrders();
    final upcomingOrders = orders.where((order) {
      return order.status == OrderStatus.confirmed ||
          order.status == OrderStatus.traveling;
    }).toList();

    final itineraryItems = upcomingOrders
        .map((order) => ItineraryItemModel.fromOrder(order))
        .toList();

    final groupedByDate = <DateTime, List<ItineraryItemModel>>{};
    for (var item in itineraryItems) {
      final dateKey = DateTime(item.date.year, item.date.month, item.date.day);
      if (!groupedByDate.containsKey(dateKey)) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey]!.add(item);
    }

    final dailyItineraries = groupedByDate.entries.map((entry) {
      final sortedItems = entry.value
        ..sort((a, b) {
          if (a.type == ItineraryItemType.flight &&
              b.type != ItineraryItemType.flight) {
            return -1;
          } else if (a.type != ItineraryItemType.flight &&
              b.type == ItineraryItemType.flight) {
            return 1;
          }
          return 0;
        });

      return DailyItineraryModel(
        date: entry.key,
        items: sortedItems,
      );
    }).toList();

    dailyItineraries.sort((a, b) => a.date.compareTo(b.date));

    return dailyItineraries;
  }

  /// Get upcoming itinerary items
  Future<List<ItineraryItemModel>> fetchUpcomingItinerary({int days = 7}) async {
    await Future.delayed(const Duration(milliseconds: 300));

    final now = DateTime.now();
    final endDate = now.add(Duration(days: days));

    final dailyItineraries = await fetchDailyItinerary();

    final upcomingItems = <ItineraryItemModel>[];
    for (var daily in dailyItineraries) {
      if (daily.date.isAfter(now) && daily.date.isBefore(endDate)) {
        upcomingItems.addAll(daily.items);
      }
    }

    return upcomingItems;
  }

  /// Check if user has active itinerary
  Future<bool> hasActiveItinerary() async {
    final dailyItineraries = await fetchDailyItinerary();
    return dailyItineraries.isNotEmpty;
  }
}
