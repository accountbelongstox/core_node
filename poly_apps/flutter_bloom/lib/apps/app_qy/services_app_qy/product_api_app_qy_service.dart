// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import '../../../common/network/network_framework.dart';
import '../config_app_qy/api_endpoints_app_qy.dart';
import '../config_app_qy/api_data_models_app_qy.dart';

/// Product management API service for app_qy
/// Uses the new unified network framework
class ProductApiAppQyService extends AdvancedNetworkService {
  ProductApiAppQyService(BuildContext context) : super();

  @override
  String get serviceName => 'ProductApiAppQyService';

  @override
  ApiConfig get apiConfig => ApiConfig.jwtAuth(
        baseUrl: 'https://api.example.com',
        responseValidation: ResponseValidationConfig.defaultConfig(),
      );

  @override
  EndpointConfig get endpointConfig => EndpointConfig(appName: 'app_qy');

  /// POST request with authentication verification
  Future<NetworkResponse<Map<String, dynamic>>> postRequest(
      String endpoint, Map<String, dynamic> data) async {
    return await request<Map<String, dynamic>>(
      endpoint,
      data: data,
    );
  }

  /// GET request with authentication verification
  Future<NetworkResponse<Map<String, dynamic>>> getRequest(String endpoint,
      {Map<String, String>? queryParams}) async {
    return await request<Map<String, dynamic>>(
      endpoint,
      queryParameters: queryParams,
    );
  }

  /// PUT request with authentication verification
  Future<NetworkResponse<Map<String, dynamic>>> putRequest(
      String endpoint, Map<String, dynamic> data) async {
    return await request<Map<String, dynamic>>(
      endpoint,
      data: data,
    );
  }

  /// DELETE request with authentication verification
  Future<NetworkResponse<Map<String, dynamic>>> deleteRequest(
      String endpoint) async {
    return await request<Map<String, dynamic>>(endpoint);
  }

  /// Get content list
  Future<List<ContentData>> getContentList({
    int limit = 20,
    int offset = 0,
    String? category,
  }) async {
    final queryParams = {
      'limit': limit.toString(),
      'offset': offset.toString(),
    };

    if (category != null) {
      queryParams['category'] = category;
    }

    final response = await getRequest(
      ApiEndpointsAppQy.contentList,
      queryParams: queryParams,
    );

    if (response.isSuccess && response.data != null) {
      final contentList = response.data!['data'] ?? response.data!['content'];

      if (contentList is List) {
        return contentList.map((item) => ContentData.fromJson(item)).toList();
      }
    }

    return [];
  }

  /// Get content detail by ID
  Future<ContentData?> getContentDetail(String contentId) async {
    final endpoint = ApiEndpointsAppQy.getContentDetail(contentId);
    final response = await getRequest(endpoint);

    if (response.isSuccess && response.data != null) {
      final contentData = response.data!['content'] ?? response.data!['data'];

      if (contentData != null) {
        return ContentData.fromJson(contentData);
      }
    }

    return null;
  }

  /// Create new content
  Future<ContentData?> createContent(
      CreateContentRequestData contentData) async {
    final response = await postRequest(
      ApiEndpointsAppQy.contentCreate,
      contentData.toJson(),
    );

    if (response.isSuccess && response.data != null) {
      final createdContent =
          response.data!['content'] ?? response.data!['data'];

      if (createdContent != null) {
        return ContentData.fromJson(createdContent);
      }
    }

    return null;
  }

  /// Update content
  Future<bool> updateContent(
      String contentId, Map<String, dynamic> updateData) async {
    final endpoint = ApiEndpointsAppQy.getContentUpdate(contentId);
    final response = await putRequest(endpoint, updateData);

    return response.isSuccess;
  }

  /// Delete content
  Future<bool> deleteContent(String contentId) async {
    final endpoint = ApiEndpointsAppQy.getContentDelete(contentId);
    final response = await deleteRequest(endpoint);

    return response.isSuccess;
  }

  /// Search content
  Future<List<ContentData>> searchContent({
    required String query,
    String? category,
    ContentType? type,
    int limit = 20,
  }) async {
    final queryParams = {
      'q': query,
      'limit': limit.toString(),
    };

    if (category != null) queryParams['category'] = category;
    if (type != null) queryParams['type'] = type.value;

    final response = await getRequest(
      ApiEndpointsAppQy.contentSearch,
      queryParams: queryParams,
    );

    if (response.isSuccess && response.data != null) {
      final searchResults = response.data!['results'] ?? response.data!['data'];

      if (searchResults is List) {
        return searchResults.map((item) => ContentData.fromJson(item)).toList();
      }
    }

    return [];
  }

  /// Get content categories
  Future<List<Map<String, dynamic>>> getContentCategories() async {
    final response = await get(ApiEndpointsAppQy.contentCategories);

    if (response.isSuccess && response.data != null) {
      final categories = response.data!['categories'] ?? response.data!['data'];

      if (categories is List) {
        return categories.cast<Map<String, dynamic>>();
      }
    }

    return [];
  }

  /// Get user's favorite content
  Future<List<ContentData>> getFavoriteContent({
    int limit = 20,
    int offset = 0,
  }) async {
    final response = await getRequest(
      ApiEndpointsAppQy.contentFavorites,
      queryParams: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );

    if (response.isSuccess && response.data != null) {
      final favorites = response.data!['favorites'] ?? response.data!['data'];

      if (favorites is List) {
        return favorites.map((item) => ContentData.fromJson(item)).toList();
      }
    }

    return [];
  }

  /// Add content to favorites
  Future<bool> addToFavorites(String contentId) async {
    final response = await postRequest(
      ApiEndpointsAppQy.contentFavorites,
      {'content_id': contentId},
    );

    return response.isSuccess;
  }

  /// Remove content from favorites
  Future<bool> removeFromFavorites(String contentId) async {
    final response = await deleteRequest(
      '${ApiEndpointsAppQy.contentFavorites}/$contentId',
    );

    return response.isSuccess;
  }

  /// Check if user is authenticated
  @override
  bool get isAuthenticated => super.isAuthenticated;

  /// Get service status
  Map<String, dynamic> getServiceStatus() {
    return {
      'service_name': 'ProductApiAppQyService',
      'auth_status': isAuthenticated,
      'app_name': 'app_qy',
    };
  }
}
