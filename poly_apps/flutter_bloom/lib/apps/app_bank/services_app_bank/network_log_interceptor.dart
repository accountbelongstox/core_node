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

import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../common/network/core/network_types.dart';
import '../../../common/network/core/api_endpoint_manager.dart';
import 'network_log_storage.dart';

class NetworkLogInterceptor {
  static Future<void> logRequest({
    required String method,
    required String url,
    Map<String, String>? headers,
    dynamic body,
    required String requestId,
  }) async {
    try {
      final endpointManager = ApiEndpointManager();
      final currentEndpoint = endpointManager.currentEndpoint;
      final endpointId = currentEndpoint?.id ?? 'unknown';

      final logEntry = NetworkLogEntry(
        id: requestId,
        timestamp: DateTime.now(),
        method: method,
        url: url,
        requestHeaders: headers,
        requestBody: body,
        endpointId: endpointId,
      );

      await NetworkLogStorage.saveLog(logEntry);
    } catch (e) {
      debugPrint('Error logging request: $e');
    }
  }

  static Future<void> logResponse({
    required String requestId,
    int? statusCode,
    String? statusMessage,
    Map<String, String>? headers,
    dynamic body,
    Duration? duration,
    String? error,
  }) async {
    try {
      final logs = await NetworkLogStorage.getLogs();
      final logIndex = logs.indexWhere((log) => log.id == requestId);
      
      if (logIndex != -1) {
        final existingLog = logs[logIndex];
        final updatedLog = NetworkLogEntry(
          id: existingLog.id,
          timestamp: existingLog.timestamp,
          method: existingLog.method,
          url: existingLog.url,
          statusCode: statusCode,
          statusMessage: statusMessage,
          requestHeaders: existingLog.requestHeaders,
          responseHeaders: headers,
          requestBody: existingLog.requestBody,
          responseBody: body,
          duration: duration,
          error: error,
          endpointId: existingLog.endpointId,
        );

        logs[logIndex] = updatedLog;
        await NetworkLogStorage.saveLog(updatedLog);
      }
    } catch (e) {
      debugPrint('Error logging response: $e');
    }
  }
}
