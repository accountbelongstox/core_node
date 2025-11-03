import '../models_app_travel/hot_content_model.dart';
import '../models_app_travel/travel_inspiration_model.dart';
import '../data/journey_data.dart';

/// Service for managing journey-related data and business logic
class JourneyService {
  /// Get all travel inspirations
  Future<List<TravelInspirationModel>> fetchTravelInspirations() async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 300));
    return JourneyData.getTravelInspirations();
  }

  /// Get all hot contents
  Future<List<HotContentModel>> fetchHotContents() async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 300));
    return JourneyData.getHotContents();
  }

  /// Get hot contents by category
  Future<List<HotContentModel>> fetchHotContentsByCategory(
      String category) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return JourneyData.getHotContentsByCategory(category);
  }

  /// Get top hot contents
  Future<List<HotContentModel>> fetchTopHotContents({int limit = 10}) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return JourneyData.getTopHotContents(limit: limit);
  }

  /// Search hot contents
  Future<List<HotContentModel>> searchHotContents(String keyword) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return JourneyData.searchHotContents(keyword);
  }

  /// Like a hot content
  Future<bool> likeHotContent(String contentId) async {
    // In a real app, this would make an API call
    await Future.delayed(const Duration(milliseconds: 200));
    return true;
  }

  /// Unlike a hot content
  Future<bool> unlikeHotContent(String contentId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return true;
  }
}
