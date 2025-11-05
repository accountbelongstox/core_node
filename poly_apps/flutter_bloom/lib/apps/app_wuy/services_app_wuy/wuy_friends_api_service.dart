// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:qyflutter/common/network/network_framework.dart';
import '../models_app_wuy/friend_model_app_wuy.dart';
import 'wuy_api_client.dart' as wuy_endpoints;
import 'wuy_api_response.dart';

/// Friends API Service for Wuy App
/// Handles all friends-related API calls
class WuyFriendsApiService {
  final UnifiedNetworkClient _networkClient;

  WuyFriendsApiService(this._networkClient);

  // ==================== FRIENDS LIST ====================
  /// Get friends list
  ///
  /// [accessToken] - User's access token
  /// [page] - Page number for pagination (default: 1)
  /// [limit] - Number of items per page (default: 20)
  ///
  /// Returns list of friends
  Future<WuyApiResponse<List<FriendModelAppWuy>>> getFriendsList({
    required String accessToken,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final endpoint = wuy_endpoints.ApiEndpointsAppWuy.buildPaginatedEndpoint(
        wuy_endpoints.ApiEndpointsAppWuy.friendsList,
        page: page,
        limit: limit,
      );

      final request = NetworkRequest(
        endpoint: endpoint,
        method: RequestMethod.get,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final data = response.data!;
        final friendsList = data['data'] as List<dynamic>? ?? data['friends'] as List<dynamic>? ?? [];

        final friends = friendsList
            .map((friend) => FriendModelAppWuy.fromJson(friend as Map<String, dynamic>))
            .toList();

        return WuyApiResponse.success(
          data: friends,
          message: 'Friends list retrieved successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to get friends list',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== ADD FRIEND ====================
  /// Send friend request
  ///
  /// [accessToken] - User's access token
  /// [userId] - User ID to send friend request to
  ///
  /// Returns friend request information
  Future<WuyApiResponse<FriendRequestResponse>> sendFriendRequest({
    required String accessToken,
    required String userId,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.friendsAdd,
        method: RequestMethod.post,
        body: {'user_id': userId},
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final data = response.data!;
        final requestData = data['data'] as Map<String, dynamic>? ?? data;

        final friendRequest = FriendRequestResponse(
          requestId: requestData['request_id']?.toString() ?? '',
          status: requestData['status']?.toString() ?? 'pending',
          createdAt: requestData['created_at'] != null
              ? DateTime.parse(requestData['created_at'])
              : DateTime.now(),
        );

        return WuyApiResponse.success(
          data: friendRequest,
          message: 'Friend request sent successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to send friend request',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  /// Send friend request by username
  ///
  /// [accessToken] - User's access token
  /// [username] - Username to send friend request to
  ///
  /// Returns friend request information
  Future<WuyApiResponse<FriendRequestResponse>> sendFriendRequestByUsername({
    required String accessToken,
    required String username,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.friendsAdd,
        method: RequestMethod.post,
        body: {'username': username},
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final data = response.data!;
        final requestData = data['data'] as Map<String, dynamic>? ?? data;

        final friendRequest = FriendRequestResponse(
          requestId: requestData['request_id']?.toString() ?? '',
          status: requestData['status']?.toString() ?? 'pending',
          createdAt: requestData['created_at'] != null
              ? DateTime.parse(requestData['created_at'])
              : DateTime.now(),
        );

        return WuyApiResponse.success(
          data: friendRequest,
          message: 'Friend request sent successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to send friend request',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== REMOVE FRIEND ====================
  /// Remove friend
  ///
  /// [accessToken] - User's access token
  /// [friendId] - Friend ID to remove
  Future<WuyApiResponse<void>> removeFriend({
    required String accessToken,
    required String friendId,
  }) async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.friendsRemove,
        method: RequestMethod.delete,
        body: {'friend_id': friendId},
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Friend removed successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to remove friend',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== FRIEND INFO ====================

  /// Get friend information
  ///
  /// [accessToken] - User's access token
  /// [friendId] - Friend ID to get information for
  Future<WuyApiResponse<FriendModelAppWuy>> getFriendInfo({
    required String accessToken,
    required String friendId,
  }) async {
    try {
      final endpoint = '${wuy_endpoints.ApiEndpointsAppWuy.friendsInfo}/$friendId';

      final request = NetworkRequest(
        endpoint: endpoint,
        method: RequestMethod.get,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final data = response.data!;
        final friendData = data['data'] as Map<String, dynamic>? ?? data;

        final friend = FriendModelAppWuy.fromJson(friendData);

        return WuyApiResponse.success(
          data: friend,
          message: 'Friend information retrieved successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to get friend information',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== SEARCH FRIENDS ====================

  /// Search for friends
  ///
  /// [accessToken] - User's access token
  /// [query] - Search query
  /// [page] - Page number for pagination (default: 1)
  /// [limit] - Number of items per page (default: 20)
  ///
  /// Returns list of users matching search query
  Future<WuyApiResponse<List<FriendModelAppWuy>>> searchFriends({
    required String accessToken,
    required String query,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final endpoint = wuy_endpoints.ApiEndpointsAppWuy.buildPaginatedEndpoint(
        wuy_endpoints.ApiEndpointsAppWuy.friendsSearch,
        page: page,
        limit: limit,
        additionalParams: {'query': query},
      );

      final request = NetworkRequest(
        endpoint: endpoint,
        method: RequestMethod.get,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        final data = response.data!;
        final searchResults = data['data'] as List<dynamic>? ?? data['results'] as List<dynamic>? ?? [];

        final friends = searchResults
            .map((user) => FriendModelAppWuy.fromJson(user as Map<String, dynamic>))
            .toList();

        return WuyApiResponse.success(
          data: friends,
          message: 'Search completed successfully',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Search failed',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== FRIEND SYSTEM HEALTH ====================

  /// Check friend system health
  Future<WuyApiResponse<Map<String, dynamic>>> checkFriendSystemHealth() async {
    try {
      final request = NetworkRequest(
        endpoint: wuy_endpoints.ApiEndpointsAppWuy.friendsHealth,
        method: RequestMethod.get,
        headers: {'Content-Type': 'application/json'},
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess && response.data != null) {
        return WuyApiResponse.success(
          data: response.data!,
          message: 'Friend system is healthy',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Friend system health check failed',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== FRIEND REQUEST MANAGEMENT ====================

  /// Accept friend request
  ///
  /// [accessToken] - User's access token
  /// [requestId] - Friend request ID to accept
  Future<WuyApiResponse<void>> acceptFriendRequest({
    required String accessToken,
    required String requestId,
  }) async {
    try {
      final endpoint = '${wuy_endpoints.ApiEndpointsAppWuy.friendsAdd}/accept/$requestId';

      final request = NetworkRequest(
        endpoint: endpoint,
        method: RequestMethod.post,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Friend request accepted',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to accept friend request',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  /// Decline friend request
  ///
  /// [accessToken] - User's access token
  /// [requestId] - Friend request ID to decline
  Future<WuyApiResponse<void>> declineFriendRequest({
    required String accessToken,
    required String requestId,
  }) async {
    try {
      final endpoint = '${wuy_endpoints.ApiEndpointsAppWuy.friendsAdd}/decline/$requestId';

      final request = NetworkRequest(
        endpoint: endpoint,
        method: RequestMethod.post,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      );

      final response = await _networkClient.request<Map<String, dynamic>>(request);

      if (response.isSuccess) {
        return WuyApiResponse.success(
          message: 'Friend request declined',
        );
      } else {
        return WuyApiResponse.error(
          message: response.error ?? 'Failed to decline friend request',
          errorCode: _extractErrorCode(response.data),
        );
      }
    } catch (e) {
      return WuyApiResponse.error(
        message: 'Network error: ${e.toString()}',
        errorCode: 'NETWORK_ERROR',
      );
    }
  }

  // ==================== HELPER METHODS ====================

  /// Extract error code from API response
  String? _extractErrorCode(Map<String, dynamic>? data) {
    if (data?['error'] is Map) {
      return (data!['error'] as Map)['code']?.toString();
    }
    return data?['error_code']?.toString();
  }
}

/// Friend request response model
class FriendRequestResponse {
  final String requestId;
  final String status;
  final DateTime createdAt;

  FriendRequestResponse({
    required this.requestId,
    required this.status,
    required this.createdAt,
  });

  /// Create FriendRequestResponse from JSON
  factory FriendRequestResponse.fromJson(Map<String, dynamic> json) {
    return FriendRequestResponse(
      requestId: json['request_id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'pending',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'request_id': requestId,
      'status': status,
      'created_at': createdAt.toIso8601String(),
    };
  }

  @override
  String toString() {
    return 'FriendRequestResponse(id: $requestId, status: $status)';
  }
}
