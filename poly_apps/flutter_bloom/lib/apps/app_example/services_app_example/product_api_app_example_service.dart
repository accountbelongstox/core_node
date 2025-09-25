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
import '../../../common/controller/auth_controller.dart';
import '../../../common/network/api_client.dart';
import '../config_app_example/api_config_app_example.dart';
import '../config_app_example/api_endpoints_app_example.dart';
import '../config_app_example/api_data_models_app_example.dart';

/// Product management API service for app_example
/// Demonstrates how to reuse the same AuthObject across different API services
class ProductApiAppExampleService {
  final AuthObject authObject;

  ProductApiAppExampleService({required this.authObject});

  /// Factory constructor to create service with shared auth object
  factory ProductApiAppExampleService.withSharedAuth(AuthObject authObject) {
    return ProductApiAppExampleService(authObject: authObject);
  }

  /// Factory constructor to create service with new auth object
  factory ProductApiAppExampleService.withContext(BuildContext context) {
    final authObject = AuthController.createAuthObject(
      apiConfig: AppEnvironmentConfig.currentApiConfig,
      authEndpoints: ApiConfigAppExample.authEndpoints,
      userDataParser: ApiConfigAppExample.parseUserFromResponse,
      tokenExtractor: ApiConfigAppExample.extractTokenFromResponse,
      tokenTypeExtractor: ApiConfigAppExample.extractTokenTypeFromResponse,
      expirationExtractor: ApiConfigAppExample.extractExpirationFromResponse,
      messageExtractor: ApiConfigAppExample.extractMessageFromResponse,
      errorExtractor: ApiConfigAppExample.extractErrorFromResponse,
      context: context,
    );
    
    return ProductApiAppExampleService(authObject: authObject);
  }


  /// POST request with authentication verification
  Future<Response> post(String endpoint, Map<String, dynamic> data) async {
    if (!authObject.isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (authObject.isLoginExpired()) {
      final refreshResult = await authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await authObject.authenticatedClient.post(endpoint, data);
  }

  /// GET request with authentication verification
  Future<Response> get(String endpoint, {Map<String, String>? queryParams}) async {
    if (!authObject.isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (authObject.isLoginExpired()) {
      final refreshResult = await authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await authObject.authenticatedClient.get(endpoint, queryParams: queryParams);
  }

  /// PUT request with authentication verification
  Future<Response> put(String endpoint, Map<String, dynamic> data) async {
    if (!authObject.isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (authObject.isLoginExpired()) {
      final refreshResult = await authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await authObject.authenticatedClient.put(endpoint, data);
  }

  /// DELETE request with authentication verification
  Future<Response> delete(String endpoint) async {
    if (!authObject.isLoggedIn()) {
      return _createUnauthenticatedResponse();
    }

    if (authObject.isLoginExpired()) {
      final refreshResult = await authObject.refreshToken();
      
      if (!refreshResult.isSuccess) {
        return _createUnauthenticatedResponse();
      }
    }

    return await authObject.authenticatedClient.delete(endpoint);
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

    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.contentList,
      queryParams: queryParams,
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final contentList = body['data'] ?? body['content'];
      
      if (contentList is List) {
        return contentList
            .map((item) => ContentData.fromJson(item))
            .toList();
      }
    }

    return [];
  }

  /// Get content detail by ID
  Future<ContentData?> getContentDetail(String contentId) async {
    if (!authObject.isLoggedIn()) {
      return null;
    }

    final endpoint = ApiEndpointsAppExample.getContentDetail(contentId);
    final response = await authObject.authenticatedClient.get(endpoint);

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final contentData = body['content'] ?? body['data'];
      
      if (contentData != null) {
        return ContentData.fromJson(contentData);
      }
    }

    return null;
  }

  /// Create new content
  Future<ContentData?> createContent(CreateContentRequestData contentData) async {
    if (!authObject.isLoggedIn()) {
      return null;
    }

    final response = await authObject.authenticatedClient.post(
      ApiEndpointsAppExample.contentCreate,
      contentData.toJson(),
    );

    if (response.statusCode == 201 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final createdContent = body['content'] ?? body['data'];
      
      if (createdContent != null) {
        return ContentData.fromJson(createdContent);
      }
    }

    return null;
  }

  /// Update content
  Future<bool> updateContent(String contentId, Map<String, dynamic> updateData) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final endpoint = ApiEndpointsAppExample.getContentUpdate(contentId);
    final response = await authObject.authenticatedClient.put(endpoint, updateData);

    return response.statusCode == 200;
  }

  /// Delete content
  Future<bool> deleteContent(String contentId) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final endpoint = ApiEndpointsAppExample.getContentDelete(contentId);
    final response = await authObject.authenticatedClient.delete(endpoint);

    return response.statusCode == 200;
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

    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.contentSearch,
      queryParams: queryParams,
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final searchResults = body['results'] ?? body['data'];
      
      if (searchResults is List) {
        return searchResults
            .map((item) => ContentData.fromJson(item))
            .toList();
      }
    }

    return [];
  }

  /// Get content categories
  Future<List<Map<String, dynamic>>> getContentCategories() async {
    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.contentCategories,
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final categories = body['categories'] ?? body['data'];
      
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
    if (!authObject.isLoggedIn()) {
      return [];
    }

    final response = await authObject.authenticatedClient.get(
      ApiEndpointsAppExample.contentFavorites,
      queryParams: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );

    if (response.statusCode == 200 && response.body is Map<String, dynamic>) {
      final body = response.body as Map<String, dynamic>;
      final favorites = body['favorites'] ?? body['data'];
      
      if (favorites is List) {
        return favorites
            .map((item) => ContentData.fromJson(item))
            .toList();
      }
    }

    return [];
  }

  /// Add content to favorites
  Future<bool> addToFavorites(String contentId) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final response = await authObject.authenticatedClient.post(
      ApiEndpointsAppExample.contentFavorites,
      {'content_id': contentId},
    );

    return response.statusCode == 200;
  }

  /// Remove content from favorites
  Future<bool> removeFromFavorites(String contentId) async {
    if (!authObject.isLoggedIn()) {
      return false;
    }

    final response = await authObject.authenticatedClient.delete(
      '${ApiEndpointsAppExample.contentFavorites}/$contentId',
    );

    return response.statusCode == 200;
  }


  /// Check if user is authenticated (delegate to auth object)
  bool isAuthenticated() {
    return authObject.isLoggedIn();
  }

  /// Create unauthenticated response
  Response _createUnauthenticatedResponse() {
    return Response(
      body: {
        'error': 'User not authenticated or session expired',
        'code': 'UNAUTHENTICATED',
        'requires_login': true,
        'app_id': 'app_example',
      },
      bodyString: '{"error": "User not authenticated or session expired", "code": "UNAUTHENTICATED", "requires_login": true, "app_id": "app_example"}',
      statusCode: 401,
      headers: {'x-auth-status': 'UNAUTHENTICATED'},
      method: 'ERROR',
    );
  }

  /// Get service status
  Map<String, dynamic> getServiceStatus() {
    return {
      'service_name': 'ProductApiAppExampleService',
      'auth_status': authObject.getAuthStatus(),
      'cache_stats': authObject.getCacheStats(),
    };
  }

  /// Clear cache (delegate to auth object)
  void clearCache() {
    authObject.clearCache();
  }
}
