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
