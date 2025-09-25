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

import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/network/api_client.dart';
import 'package:qyflutter/common/network/laravel_auth_apis.dart';

class WordGroup {
  final String gid;
  final String gname;
  final List<String> gwords;
  final int totalWords;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Map<String, int> wordsFrequency;

  WordGroup({
    required this.gid,
    required this.gname,
    required this.gwords,
    required this.totalWords,
    required this.createdAt,
    required this.updatedAt,
    required this.wordsFrequency,
  });

  factory WordGroup.fromJson(Map<String, dynamic> json) {
    Map<String, int> parseWordsFrequency(dynamic wordsFreq) {
      if (wordsFreq is List) {
        return {};
      }
      if (wordsFreq is Map) {
        return Map<String, int>.from(wordsFreq.map((key, value) =>
            MapEntry(key.toString(), (value is num) ? value.toInt() : 0)));
      }
      return {};
    }

    return WordGroup(
      gid: json['gid'] as String,
      gname: json['gname'] as String,
      gwords: List<String>.from(json['gwords'] ?? []),
      totalWords: json['total_words'] as int,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      wordsFrequency: parseWordsFrequency(json['words_frequency']),
    );
  }
}

class GroupApi {
  final BuildContext context;

  GroupApi(this.context);

  Future<List<WordGroup>> fetchWordGroups() async {
    try {
      final response = await ApiClient(context: context).postData(
        LaravelAuthApis.laravelQueryAllGroupsApi,
        {},
      );

      if (response.statusCode == 200 && response.body != null) {
        final Map<String, dynamic> responseData = response.body;
        if (responseData['status'] == 'success' &&
            responseData['data'] != null) {
          final groupsData = responseData['data']['groups'] as List<dynamic>;
          return groupsData
              .map((group) => WordGroup.fromJson(group as Map<String, dynamic>))
              .toList();
        } else {
          throw Exception('Invalid data format');
        }
      } else {
        throw Exception('Failed to load word groups');
      }
    } catch (e) {
      log('Error fetching word groups: $e');
      throw Exception('Error: $e');
    }
  }
}
