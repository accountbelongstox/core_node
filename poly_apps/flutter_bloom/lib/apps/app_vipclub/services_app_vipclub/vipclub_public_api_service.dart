import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:qyflutter/apps/app_vipclub/config_app_vipclub/app_config.dart';

class VipClubPublicApiService {
  final String baseUrl;

  VipClubPublicApiService({String? baseUrl})
      : baseUrl = baseUrl ?? VipClubAppConfig.apiBaseUrl;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  Future<Map<String, dynamic>> postRequest(
    String endpoint,
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/$endpoint'),
        headers: _headers,
        body: jsonEncode(data),
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'data': jsonDecode(response.body),
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['message'] ?? 'Request failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> getRequest(String endpoint) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/${VipClubAppConfig.apiVersion}/$endpoint'),
        headers: _headers,
      ).timeout(Duration(milliseconds: VipClubAppConfig.requestTimeout));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'data': jsonDecode(response.body),
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['message'] ?? 'Request failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Network error: ${e.toString()}',
      };
    }
  }

  Future<Map<String, dynamic>> getFacilities({String? type}) async {
    final endpoint = type != null ? 'facilities?type=$type' : 'facilities';
    return await getRequest(endpoint);
  }

  Future<Map<String, dynamic>> getFacilityDetails(String facilityId) async {
    return await getRequest('facilities/$facilityId');
  }

  Future<Map<String, dynamic>> getAvailableTimeSlots({
    required String facilityId,
    required String date,
  }) async {
    return await getRequest('facilities/$facilityId/slots?date=$date');
  }

  Future<Map<String, dynamic>> getVipBenefits() async {
    return await getRequest('vip/benefits');
  }

  Future<Map<String, dynamic>> getMembershipTiers() async {
    return await getRequest('memberships/tiers');
  }
}
