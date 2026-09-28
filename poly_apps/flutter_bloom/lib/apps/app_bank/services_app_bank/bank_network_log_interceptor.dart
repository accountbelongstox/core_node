import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../common/network/core/endpoint_network_models.dart';
import '../../../common/network/interceptors/network_interceptors.dart';
import '../../../common/network/core/api_endpoint_manager.dart';
import 'network_log_storage.dart';

void unawaited(Future<void> future) {
  // Helper to mark futures as intentionally unawaited
}

class BankNetworkLogRequestInterceptor extends RequestInterceptor {
  @override
  Future<NetworkRequest> onRequest(NetworkRequest request) async {
    unawaited(_logRequest(request));
    return request;
  }

  Future<void> _logRequest(NetworkRequest request) async {
    try {
      final endpointManager = ApiEndpointManager();
      final currentEndpoint = endpointManager.currentEndpoint;
      final endpointId = currentEndpoint?.id ?? 'unknown';

      final fullUrl = request.path.startsWith('http')
          ? request.path
          : '${currentEndpoint?.baseUrl ?? ''}${request.path}';

      final logEntry = NetworkLogEntry(
        id: request.id,
        timestamp: DateTime.now(),
        method: request.method.toUpperCase(),
        url: fullUrl,
        requestHeaders: request.headers,
        requestBody: request.data,
        endpointId: endpointId,
      );

      await NetworkLogStorage.saveLog(logEntry);
    } catch (e) {
      debugPrint('Error logging request: $e');
    }
  }
}

class BankNetworkLogResponseInterceptor extends ResponseInterceptor {
  @override
  Future<NetworkResponse<T>> onResponse<T>(NetworkResponse<T> response) async {
    unawaited(_logResponse(response));
    return response;
  }

  Future<void> _logResponse<T>(NetworkResponse<T> response) async {
    try {
      final logs = await NetworkLogStorage.getLogs();
      final logIndex = logs.indexWhere((log) => log.id == response.requestId);

      if (logIndex != -1) {
        final existingLog = logs[logIndex];
        final updatedLog = NetworkLogEntry(
          id: existingLog.id,
          timestamp: existingLog.timestamp,
          method: existingLog.method,
          url: existingLog.url,
          statusCode: response.statusCode,
          statusMessage: response.statusMessage,
          requestHeaders: existingLog.requestHeaders,
          responseHeaders: response.headers,
          requestBody: existingLog.requestBody,
          responseBody: response.rawData,
          duration: response.duration,
          error: response.error?.message,
          endpointId: existingLog.endpointId,
        );

        await NetworkLogStorage.saveLog(updatedLog);
      } else {
        final endpointManager = ApiEndpointManager();
        final currentEndpoint = endpointManager.currentEndpoint;
        final endpointId = currentEndpoint?.id ?? 'unknown';

        final logEntry = NetworkLogEntry(
          id: response.requestId,
          timestamp: DateTime.now(),
          method: 'UNKNOWN',
          url: response.requestId,
          statusCode: response.statusCode,
          statusMessage: response.statusMessage,
          responseHeaders: response.headers,
          responseBody: response.rawData,
          duration: response.duration,
          error: response.error?.message,
          endpointId: endpointId,
        );

        await NetworkLogStorage.saveLog(logEntry);
      }
    } catch (e) {
      debugPrint('Error logging response: $e');
    }
  }
}
