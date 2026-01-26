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

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class LocationResult {
  final String? province;
  final String? city;
  final String? district;
  final String? formattedAddress;

  LocationResult({
    this.province,
    this.city,
    this.district,
    this.formattedAddress,
  });
}

class LocationHelper {
  static Future<LocationResult?> getLocationFromCoordinates(
    double latitude,
    double longitude,
  ) async {
    try {
      final result = await _reverseGeocodeWithAMap(latitude, longitude);
      if (result != null) return result;

      final result2 =
          await _reverseGeocodeWithOpenStreetMap(latitude, longitude);
      if (result2 != null) return result2;

      return null;
    } catch (e) {
      if (kDebugMode) {
        print('Error getting location from coordinates: $e');
      }
      return null;
    }
  }

  static Future<LocationResult?> _reverseGeocodeWithAMap(
    double latitude,
    double longitude,
  ) async {
    try {
      const apiKey = '';
      if (apiKey.isEmpty) {
        return null;
      }

      final url = Uri.parse(
        'https://restapi.amap.com/v3/geocode/regeo?'
        'key=$apiKey&'
        'location=$longitude,$latitude&'
        'output=json&'
        'radius=1000&'
        'extensions=all',
      );

      final response = await http.get(url).timeout(
            const Duration(seconds: 5),
          );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['status'] == '1' && data['regeocode'] != null) {
          final regeocode = data['regeocode'];
          final addressComponent = regeocode['addressComponent'];

          if (addressComponent != null) {
            String? province = addressComponent['province'];
            String? city = addressComponent['city'];
            String? district = addressComponent['district'];

            if (province != null && province.isNotEmpty) {
              province = province
                  .replaceAll('省', '')
                  .replaceAll('市', '')
                  .replaceAll('自治区', '')
                  .replaceAll('特别行政区', '')
                  .replaceAll('维吾尔', '')
                  .replaceAll('回族', '')
                  .replaceAll('壮族', '')
                  .trim();
              if (province.isNotEmpty &&
                  !province.endsWith('省') &&
                  !province.endsWith('市') &&
                  !province.endsWith('自治区')) {
                province = '$province省';
              }
            }

            if (city != null && city.isNotEmpty) {
              city = city.replaceAll('市', '').trim();
              if (city.isNotEmpty && !city.endsWith('市')) {
                city = '$city市';
              }
            }

            return LocationResult(
              province: province,
              city: city,
              district: district,
              formattedAddress: regeocode['formatted_address'],
            );
          }
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('AMap reverse geocoding error: $e');
      }
    }
    return null;
  }

  static Future<LocationResult?> _reverseGeocodeWithOpenStreetMap(
    double latitude,
    double longitude,
  ) async {
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?'
        'format=json&'
        'lat=$latitude&'
        'lon=$longitude&'
        'addressdetails=1&'
        'accept-language=zh-CN,zh,en',
      );

      final response = await http.get(
        url,
        headers: {
          'User-Agent': 'FlutterBankApp/1.0',
        },
      ).timeout(
        const Duration(seconds: 5),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final address = data['address'];

        if (address != null) {
          String? province;
          String? city;
          String? district;

          if (address['state'] != null) {
            province = address['state'] as String;
            province = province
                .replaceAll('省', '')
                .replaceAll('市', '')
                .replaceAll('自治区', '')
                .replaceAll('特别行政区', '')
                .replaceAll('维吾尔', '')
                .replaceAll('回族', '')
                .replaceAll('壮族', '')
                .trim();
            if (province.isNotEmpty &&
                !province.endsWith('省') &&
                !province.endsWith('市') &&
                !province.endsWith('自治区')) {
              province = '$province省';
            }
          } else if (address['province'] != null) {
            province = address['province'] as String;
            province = province
                .replaceAll('省', '')
                .replaceAll('市', '')
                .replaceAll('自治区', '')
                .replaceAll('特别行政区', '')
                .replaceAll('维吾尔', '')
                .replaceAll('回族', '')
                .replaceAll('壮族', '')
                .trim();
            if (province.isNotEmpty &&
                !province.endsWith('省') &&
                !province.endsWith('市') &&
                !province.endsWith('自治区')) {
              province = '$province省';
            }
          }

          if (address['city'] != null) {
            city = address['city'] as String;
            city = city.replaceAll('市', '').trim();
            if (city.isNotEmpty && !city.endsWith('市')) {
              city = '$city市';
            }
          } else if (address['town'] != null) {
            city = address['town'] as String;
            city = city.replaceAll('市', '').trim();
            if (city.isNotEmpty && !city.endsWith('市')) {
              city = '$city市';
            }
          }

          if (address['district'] != null) {
            district = address['district'] as String;
          } else if (address['county'] != null) {
            district = address['county'] as String;
          }

          return LocationResult(
            province: province,
            city: city,
            district: district,
            formattedAddress: data['display_name'],
          );
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('OpenStreetMap reverse geocoding error: $e');
      }
    }
    return null;
  }
}
