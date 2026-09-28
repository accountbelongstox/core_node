import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:qyflutter/apps/app_vipclub/config_app_vipclub/app_config.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/payment_model_app_vipclub.dart';

/// Payments API Service
class VipClubPaymentsApiService {
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

  /// Create payment
  ///
  /// [bookingId] - Optional booking ID if payment is for a booking
  /// [membershipTier] - Optional membership tier if payment is for subscription
  /// [amount] - Payment amount
  /// [currency] - Currency code (USD, EUR, etc.)
  /// [paymentMethod] - Payment method (stripe, paypal, wechat, alipay)
  Future<Map<String, dynamic>> createPayment({
    String? bookingId,
    String? membershipTier,
    required double amount,
    String currency = 'USD',
    required String paymentMethod,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/payments/create');

      final body = {
        'amount': amount,
        'currency': currency,
        'payment_method': paymentMethod,
        if (bookingId != null) 'booking_id': bookingId,
        if (membershipTier != null) 'membership_tier': membershipTier,
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
          'payment_id': data['payment_id'],
          'client_secret': data['client_secret'],
          'amount': data['amount'],
          'status': data['status'],
        };
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to create payment');
      }
    } catch (e) {
      throw Exception('Error creating payment: ${e.toString()}');
    }
  }

  /// Confirm payment
  ///
  /// [paymentId] - Payment ID from createPayment
  /// [paymentToken] - Payment token from payment gateway
  Future<Map<String, dynamic>> confirmPayment({
    required String paymentId,
    required String paymentToken,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/payments/confirm');

      final body = {
        'payment_id': paymentId,
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
          'transaction_id': data['transaction_id'],
          'receipt_url': data['receipt_url'],
        };
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to confirm payment');
      }
    } catch (e) {
      throw Exception('Error confirming payment: ${e.toString()}');
    }
  }

  /// Get payment history
  Future<Map<String, dynamic>> getPaymentHistory({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = {
        'page': page.toString(),
        'limit': limit.toString(),
      };

      final uri = Uri.parse('$baseUrl/payments/history')
          .replace(queryParameters: queryParams);

      final response = await http
          .get(uri, headers: _headers)
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        final payments = (data['payments'] as List?)
                ?.map((json) => VipClubPaymentModel.fromJson(json))
                .toList() ??
            [];

        return {
          'success': true,
          'payments': payments,
          'total': data['total'] ?? payments.length,
        };
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch payment history');
      }
    } catch (e) {
      throw Exception('Error fetching payment history: ${e.toString()}');
    }
  }

  /// Get payment receipt
  Future<VipClubReceiptModel> getReceipt(String paymentId) async {
    try {
      final uri = Uri.parse('$baseUrl/payments/$paymentId/receipt');

      final response = await http
          .get(uri, headers: _headers)
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return VipClubReceiptModel.fromJson(data['receipt']);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch receipt');
      }
    } catch (e) {
      throw Exception('Error fetching receipt: ${e.toString()}');
    }
  }

  /// Get payment by ID
  Future<VipClubPaymentModel> getPaymentById(String paymentId) async {
    try {
      final uri = Uri.parse('$baseUrl/payments/$paymentId');

      final response = await http
          .get(uri, headers: _headers)
          .timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return VipClubPaymentModel.fromJson(data);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Failed to fetch payment');
      }
    } catch (e) {
      throw Exception('Error fetching payment: ${e.toString()}');
    }
  }

  /// Request refund
  Future<bool> requestRefund(String paymentId, {String? reason}) async {
    try {
      final uri = Uri.parse('$baseUrl/payments/$paymentId/refund');

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
        throw Exception(error['message'] ?? 'Failed to request refund');
      }
    } catch (e) {
      throw Exception('Error requesting refund: ${e.toString()}');
    }
  }
}
