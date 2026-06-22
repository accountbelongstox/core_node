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
import 'package:flutter/foundation.dart';
import '../../../common/storage/unified_storage.dart';

class NetworkLogEntry {
  final String id;
  final DateTime timestamp;
  final String method;
  final String url;
  final int? statusCode;
  final String? statusMessage;
  final Map<String, String>? requestHeaders;
  final Map<String, String>? responseHeaders;
  final dynamic requestBody;
  final dynamic responseBody;
  final Duration? duration;
  final String? error;
  final String endpointId;

  NetworkLogEntry({
    required this.id,
    required this.timestamp,
    required this.method,
    required this.url,
    this.statusCode,
    this.statusMessage,
    this.requestHeaders,
    this.responseHeaders,
    this.requestBody,
    this.responseBody,
    this.duration,
    this.error,
    required this.endpointId,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'timestamp': timestamp.toIso8601String(),
      'method': method,
      'url': url,
      'statusCode': statusCode,
      'statusMessage': statusMessage,
      'requestHeaders': requestHeaders,
      'responseHeaders': responseHeaders,
      'requestBody': requestBody,
      'responseBody': responseBody,
      'duration': duration?.inMilliseconds,
      'error': error,
      'endpointId': endpointId,
    };
  }

  factory NetworkLogEntry.fromJson(Map<String, dynamic> json) {
    return NetworkLogEntry(
      id: json['id'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      method: json['method'] as String,
      url: json['url'] as String,
      statusCode: json['statusCode'] as int?,
      statusMessage: json['statusMessage'] as String?,
      requestHeaders: json['requestHeaders'] != null
          ? Map<String, String>.from(json['requestHeaders'] as Map)
          : null,
      responseHeaders: json['responseHeaders'] != null
          ? Map<String, String>.from(json['responseHeaders'] as Map)
          : null,
      requestBody: json['requestBody'],
      responseBody: json['responseBody'],
      duration: json['duration'] != null
          ? Duration(milliseconds: json['duration'] as int)
          : null,
      error: json['error'] as String?,
      endpointId: json['endpointId'] as String,
    );
  }
}

class NetworkLogStorage {
  static const String _storageKey = 'bank_network_logs';
  static const String _maxLogsKey = 'bank_network_logs_max';
  static const int _defaultMaxLogs = 1000;
  static const int _maxLogsLimit = 5000;

  static Future<void> saveLog(NetworkLogEntry log) async {
    try {
      final logs = await getLogs();
      
      logs.insert(0, log);
      
      final maxLogs = await _getMaxLogs();
      if (logs.length > maxLogs) {
        logs.removeRange(maxLogs, logs.length);
      }
      
      await _saveLogs(logs);
    } catch (e) {
      debugPrint('Error saving network log: $e');
    }
  }

  static Future<List<NetworkLogEntry>> getLogs({int? limit}) async {
    try {
      final logsJson = await UnifiedStorage.get<List<dynamic>>(_storageKey);
      if (logsJson == null) {
        return [];
      }
      
      final logs = logsJson
          .map((json) => NetworkLogEntry.fromJson(json as Map<String, dynamic>))
          .toList();
      
      if (limit != null && logs.length > limit) {
        return logs.take(limit).toList();
      }
      
      return logs;
    } catch (e) {
      debugPrint('Error loading network logs: $e');
      return [];
    }
  }

  static Future<void> clearLogs() async {
    try {
      await UnifiedStorage.remove(_storageKey);
    } catch (e) {
      debugPrint('Error clearing network logs: $e');
    }
  }

  static Future<int> getLogCount() async {
    final logs = await getLogs();
    return logs.length;
  }

  static Future<void> setMaxLogs(int maxLogs) async {
    final clampedMax = maxLogs.clamp(100, _maxLogsLimit);
    await UnifiedStorage.set(_maxLogsKey, clampedMax);
  }

  static Future<int> _getMaxLogs() async {
    final maxLogs = await UnifiedStorage.get<int>(_maxLogsKey);
    return maxLogs ?? _defaultMaxLogs;
  }

  static Future<void> _saveLogs(List<NetworkLogEntry> logs) async {
    final logsJson = logs.map((log) => log.toJson()).toList();
    await UnifiedStorage.set(_storageKey, logsJson);
  }
}
