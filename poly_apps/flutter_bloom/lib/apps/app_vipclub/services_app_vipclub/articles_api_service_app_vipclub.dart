import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:qyflutter/apps/app_vipclub/config_app_vipclub/app_config.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/article_model_app_vipclub.dart';

/// Articles API Service
class VipClubArticlesApiService {
  final String baseUrl = VipClubAppConfig.apiEndpoint;
  final Duration timeout = Duration(
    milliseconds: VipClubAppConfig.requestTimeout,
  );

  /// Get list of articles
  ///
  /// [category] - Optional filter by category
  /// [page] - Page number for pagination
  /// [limit] - Number of items per page
  Future<Map<String, dynamic>> getArticles({
    String? category,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, String>{
        'page': page.toString(),
        'limit': limit.toString(),
      };

      if (category != null && category.isNotEmpty) {
        queryParams['category'] = category;
      }

      final uri = Uri.parse('$baseUrl/articles')
          .replace(queryParameters: queryParams);

      final response = await http
          .get(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        final articles = (data['articles'] as List?)
                ?.map((json) => VipClubArticleModel.fromJson(json))
                .toList() ??
            [];

        return {
          'success': true,
          'articles': articles,
          'total': data['total'] ?? articles.length,
          'page': data['page'] ?? page,
        };
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch articles');
      }
    } catch (e) {
      throw Exception('Error fetching articles: ${e.toString()}');
    }
  }

  /// Get article by ID
  Future<VipClubArticleModel> getArticleById(String id) async {
    try {
      final uri = Uri.parse('$baseUrl/articles/$id');

      final response = await http
          .get(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return VipClubArticleModel.fromJson(data);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch article');
      }
    } catch (e) {
      throw Exception('Error fetching article: ${e.toString()}');
    }
  }

  /// Get article categories
  Future<List<String>> getCategories() async {
    try {
      final uri = Uri.parse('$baseUrl/articles/categories');

      final response = await http
          .get(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return List<String>.from(data['categories'] ?? []);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch categories');
      }
    } catch (e) {
      throw Exception('Error fetching categories: ${e.toString()}');
    }
  }

  /// Get featured articles
  Future<List<VipClubArticleModel>> getFeaturedArticles({int limit = 5}) async {
    try {
      final result = await getArticles(page: 1, limit: limit);
      final articles = result['articles'] as List<VipClubArticleModel>;
      return articles.where((article) => article.isFeatured).toList();
    } catch (e) {
      throw Exception('Error fetching featured articles: ${e.toString()}');
    }
  }

  /// Search articles by keyword
  Future<List<VipClubArticleModel>> searchArticles(String keyword) async {
    try {
      final queryParams = {
        'q': keyword,
        'limit': '50',
      };

      final uri = Uri.parse('$baseUrl/articles/search')
          .replace(queryParameters: queryParams);

      final response = await http
          .get(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final articles = (data['articles'] as List?)
                ?.map((json) => VipClubArticleModel.fromJson(json))
                .toList() ??
            [];
        return articles;
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to search articles');
      }
    } catch (e) {
      throw Exception('Error searching articles: ${e.toString()}');
    }
  }
}
