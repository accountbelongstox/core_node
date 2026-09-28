import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import '../config_app_travel/constants_app_travel.dart';

class DataService {
  static final DataService _instance = DataService._internal();

  factory DataService() {
    return _instance;
  }

  DataService._internal();

  Future<Map<String, dynamic>> loadHomeData() async {
    try {
      final String jsonString = await rootBundle.loadString(
        TravelAppConstants.dataPathHome,
      );
      return json.decode(jsonString);
    } catch (e) {
      throw Exception('Failed to load home data: $e');
    }
  }

  Future<Map<String, dynamic>> loadCityData() async {
    try {
      final String jsonString = await rootBundle.loadString(
        TravelAppConstants.dataPathCity,
      );
      return json.decode(jsonString);
    } catch (e) {
      throw Exception('Failed to load city data: $e');
    }
  }

  Future<Map<String, dynamic>> loadSightData(int index) async {
    try {
      String path;
      if (index == 0) {
        path = TravelAppConstants.dataPathSight0;
      } else if (index == 1) {
        path = TravelAppConstants.dataPathSight1;
      } else {
        throw Exception('Invalid sight index: $index');
      }

      final String jsonString = await rootBundle.loadString(path);
      return json.decode(jsonString);
    } catch (e) {
      throw Exception('Failed to load sight data: $e');
    }
  }

  Future<Map<String, dynamic>> loadJsonFromAsset(String assetPath) async {
    try {
      final String jsonString = await rootBundle.loadString(assetPath);
      return json.decode(jsonString);
    } catch (e) {
      throw Exception('Failed to load JSON from $assetPath: $e');
    }
  }
}
