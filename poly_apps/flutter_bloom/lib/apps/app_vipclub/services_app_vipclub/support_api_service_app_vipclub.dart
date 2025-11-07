import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:qyflutter/apps/app_vipclub/config_app_vipclub/app_config.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/support_model_app_vipclub.dart';

/// Customer Support API Service
class VipClubSupportApiService {
  final String baseUrl = VipClubAppConfig.apiEndpoint;
  final Duration timeout = Duration(
    milliseconds: VipClubAppConfig.requestTimeout,
  );

  String? _authToken;

  /// Set authentication token
  void setAuthToken(String token) {
    _authToken = token;
  }

  /// Get auth headers
  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (_authToken != null) 'Authorization': 'Bearer $_authToken',
      };

  /// Send support message
  Future<Map<String, dynamic>> sendMessage({
    required String message,
    List<String>? attachments,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/support/messages');

      final body = {
        'message': message,
        if (attachments != null && attachments.isNotEmpty)
          'attachments': attachments,
      };

      final response = await http
          .post(
            uri,
            headers: _headers,
            body: json.encode(body),
          )
          .timeout(timeout);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = json.decode(response.body);
        return {
          'success': true,
          'message_id': data['message_id'],
          'created_at': data['created_at'],
        };
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to send message');
      }
    } catch (e) {
      throw Exception('Error sending message: ${e.toString()}');
    }
  }

  /// Get support messages (conversation history)
  Future<VipClubSupportConversationModel> getMessages({
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final queryParams = {
        'page': page.toString(),
        'limit': limit.toString(),
      };

      final uri = Uri.parse('$baseUrl/support/messages')
          .replace(queryParameters: queryParams);

      final response = await http
          .get(uri, headers: _headers)
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return VipClubSupportConversationModel.fromJson(data);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch messages');
      }
    } catch (e) {
      throw Exception('Error fetching messages: ${e.toString()}');
    }
  }

  /// Mark messages as read
  Future<bool> markAsRead(List<String> messageIds) async {
    try {
      final uri = Uri.parse('$baseUrl/support/messages/read');

      final body = {
        'message_ids': messageIds,
      };

      final response = await http
          .post(
            uri,
            headers: _headers,
            body: json.encode(body),
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        return true;
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to mark as read');
      }
    } catch (e) {
      throw Exception('Error marking as read: ${e.toString()}');
    }
  }

  /// Get support contact information
  Future<VipClubSupportInfoModel> getSupportInfo() async {
    try {
      final uri = Uri.parse('$baseUrl/support/info');

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
        return VipClubSupportInfoModel.fromJson(data);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch support info');
      }
    } catch (e) {
      throw Exception('Error fetching support info: ${e.toString()}');
    }
  }

  /// Get unread message count
  Future<int> getUnreadCount() async {
    try {
      final uri = Uri.parse('$baseUrl/support/messages/unread-count');

      final response = await http
          .get(uri, headers: _headers)
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['unread_count'] ?? 0;
      } else {
        return 0;
      }
    } catch (e) {
      return 0;
    }
  }
}
