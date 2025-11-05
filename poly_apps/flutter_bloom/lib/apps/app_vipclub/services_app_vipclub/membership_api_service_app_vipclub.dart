import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:qyflutter/apps/app_vipclub/config_app_vipclub/app_config.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/vip_card_model_app_vipclub.dart';

/// Membership/VIP Subscription API Service
class VipClubMembershipApiService {
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

  /// Get available membership tiers
  Future<List<Map<String, dynamic>>> getMembershipTiers() async {
    try {
      final uri = Uri.parse('$baseUrl/memberships/tiers');

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
        return List<Map<String, dynamic>>.from(data['tiers'] ?? []);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch membership tiers');
      }
    } catch (e) {
      throw Exception('Error fetching membership tiers: ${e.toString()}');
    }
  }

  /// Subscribe to VIP membership
  ///
  /// [tier] - Membership tier (gold, platinum, diamond)
  /// [paymentMethod] - Payment method
  /// [paymentToken] - Payment token from payment gateway
  Future<Map<String, dynamic>> subscribe({
    required String tier,
    required String paymentMethod,
    required String paymentToken,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/memberships/subscribe');

      final body = {
        'tier': tier,
        'payment_method': paymentMethod,
        'payment_token': paymentToken,
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
          'success': data['success'] ?? true,
          'vip_card': data['vip_card'] != null
              ? VipClubCardModel.fromJson(data['vip_card'])
              : null,
          'transaction_id': data['transaction_id'],
        };
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to subscribe');
      }
    } catch (e) {
      throw Exception('Error subscribing: ${e.toString()}');
    }
  }

  /// Upgrade VIP membership
  ///
  /// [newTier] - New membership tier
  /// [paymentMethod] - Payment method
  /// [paymentToken] - Payment token
  Future<Map<String, dynamic>> upgrade({
    required String newTier,
    required String paymentMethod,
    required String paymentToken,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/memberships/upgrade');

      final body = {
        'new_tier': newTier,
        'payment_method': paymentMethod,
        'payment_token': paymentToken,
      };

      final response = await http
          .post(
            uri,
            headers: _headers,
            body: json.encode(body),
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {
          'success': data['success'] ?? true,
          'vip_card': data['vip_card'] != null
              ? VipClubCardModel.fromJson(data['vip_card'])
              : null,
          'transaction_id': data['transaction_id'],
        };
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to upgrade membership');
      }
    } catch (e) {
      throw Exception('Error upgrading membership: ${e.toString()}');
    }
  }

  /// Renew VIP membership
  Future<Map<String, dynamic>> renew({
    required String paymentMethod,
    required String paymentToken,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/memberships/renew');

      final body = {
        'payment_method': paymentMethod,
        'payment_token': paymentToken,
      };

      final response = await http
          .post(
            uri,
            headers: _headers,
            body: json.encode(body),
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {
          'success': data['success'] ?? true,
          'vip_card': data['vip_card'] != null
              ? VipClubCardModel.fromJson(data['vip_card'])
              : null,
          'transaction_id': data['transaction_id'],
        };
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to renew membership');
      }
    } catch (e) {
      throw Exception('Error renewing membership: ${e.toString()}');
    }
  }

  /// Cancel VIP membership
  Future<bool> cancel({String? reason}) async {
    try {
      final uri = Uri.parse('$baseUrl/memberships/cancel');

      final body = {
        if (reason != null) 'reason': reason,
      };

      final response = await http
          .post(
            uri,
            headers: _headers,
            body: json.encode(body),
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['success'] ?? true;
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to cancel membership');
      }
    } catch (e) {
      throw Exception('Error cancelling membership: ${e.toString()}');
    }
  }

  /// Get membership pricing
  Future<Map<String, dynamic>> getPricing(String tier) async {
    try {
      final uri = Uri.parse('$baseUrl/memberships/pricing/$tier');

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
        return data;
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch pricing');
      }
    } catch (e) {
      throw Exception('Error fetching pricing: ${e.toString()}');
    }
  }
}
