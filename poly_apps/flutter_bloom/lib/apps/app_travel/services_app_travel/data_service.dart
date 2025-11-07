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
