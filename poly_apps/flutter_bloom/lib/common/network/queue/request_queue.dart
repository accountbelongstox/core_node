import 'dart:async';
import 'dart:collection';
import 'package:flutter/foundation.dart';
import '../core/network_types.dart';
import '../models/api_response.dart';

/// Request queue manager for handling network requests
class RequestQueue {
  static RequestQueue? _instance;
  static RequestQueue get instance => _instance ??= RequestQueue._();
  RequestQueue._();

  final Queue<QueuedRequest> _queue = Queue<QueuedRequest>();
  final Map<String, QueuedRequest> _activeRequests = {};
  final Map<String, Completer<ApiResponse>> _requestCompleters = {};
  
  bool _isProcessing = false;
  int _maxConcurrentRequests = 5;
  int _activeRequestCount = 0;

  /// Initialize the request queue
  void initialize({
    int maxConcurrentRequests = 5,
  }) {
    _maxConcurrentRequests = maxConcurrentRequests;
  }

  /// Add request to queue
  Future<ApiResponse<T>> enqueue<T>(
    String url,
    String method, {
    Map<String, dynamic>? data,
    Map<String, String>? headers,
    RequestPriority priority = RequestPriority.normal,
    Duration? timeout,
    String? requestId,
  }) async {
    final id = requestId ?? _generateRequestId();
    
    final request = QueuedRequest(
      id: id,
      url: url,
      method: method,
      data: data,
      headers: headers,
      priority: priority,
      timeout: timeout,
      timestamp: DateTime.now(),
    );

    final completer = Completer<ApiResponse<T>>();
    _requestCompleters[id] = completer as Completer<ApiResponse>;

    // Insert based on priority
    _insertByPriority(request);
    
    // Start processing if not already running
    if (!_isProcessing) {
      _processQueue();
    }

    return completer.future as Future<ApiResponse<T>>;
  }

  /// Cancel specific request
  bool cancel(String requestId) {
    // Remove from queue
    _queue.removeWhere((request) => request.id == requestId);
    
    // Cancel active request
    final activeRequest = _activeRequests.remove(requestId);
    if (activeRequest != null) {
      _activeRequestCount--;
      final completer = _requestCompleters.remove(requestId);
      completer?.completeError(
        NetworkException('Request cancelled', requestId: requestId),
      );
      return true;
    }

    // Cancel pending request
    final completer = _requestCompleters.remove(requestId);
    if (completer != null) {
      completer.completeError(
        NetworkException('Request cancelled', requestId: requestId),
      );
      return true;
    }

    return false;
  }

  /// Cancel all requests
  void cancelAll() {
    // Cancel all pending requests
    for (final completer in _requestCompleters.values) {
      completer.completeError(
        NetworkException('All requests cancelled'),
      );
    }

    // Clear all data
    _queue.clear();
    _activeRequests.clear();
    _requestCompleters.clear();
    _activeRequestCount = 0;
  }

  /// Get queue statistics
  QueueStats getStats() {
    return QueueStats(
      queueSize: _queue.length,
      activeRequests: _activeRequestCount,
      totalRequests: _queue.length + _activeRequestCount,
      maxConcurrent: _maxConcurrentRequests,
    );
  }

  void _insertByPriority(QueuedRequest request) {
    if (_queue.isEmpty) {
      _queue.add(request);
      return;
    }

    final list = _queue.toList();
    list.add(request);
    list.sort((a, b) => b.priority.index.compareTo(a.priority.index));
    
    _queue.clear();
    _queue.addAll(list);
  }

  Future<void> _processQueue() async {
    if (_isProcessing) return;
    _isProcessing = true;

    while (_queue.isNotEmpty || _activeRequestCount > 0) {
      // Start new requests if we have capacity
      while (_queue.isNotEmpty && _activeRequestCount < _maxConcurrentRequests) {
        final request = _queue.removeFirst();
        _activeRequests[request.id] = request;
        _activeRequestCount++;
        
        // Process request asynchronously
        _processRequest(request).catchError((error) {
          if (kDebugMode) {
            print('Error processing request ${request.id}: $error');
          }
        });
      }

      // Wait a bit before checking again
      await Future.delayed(const Duration(milliseconds: 100));
    }

    _isProcessing = false;
  }

  Future<void> _processRequest(QueuedRequest request) async {
    try {
      // Simulate network request processing
      // In real implementation, this would use the actual network client
      await Future.delayed(const Duration(milliseconds: 500));
      
      final response = ApiResponse<dynamic>(
        success: true,
        data: {'message': 'Request processed successfully'},
        statusCode: 200,
      );

      final completer = _requestCompleters.remove(request.id);
      completer?.complete(response);
      
    } catch (error) {
      final completer = _requestCompleters.remove(request.id);
      completer?.completeError(error);
    } finally {
      _activeRequests.remove(request.id);
      _activeRequestCount--;
    }
  }

  String _generateRequestId() {
    return 'req_${DateTime.now().millisecondsSinceEpoch}_${_queue.length}';
  }
}

/// Queued request data structure
class QueuedRequest {
  final String id;
  final String url;
  final String method;
  final Map<String, dynamic>? data;
  final Map<String, String>? headers;
  final RequestPriority priority;
  final Duration? timeout;
  final DateTime timestamp;

  const QueuedRequest({
    required this.id,
    required this.url,
    required this.method,
    this.data,
    this.headers,
    required this.priority,
    this.timeout,
    required this.timestamp,
  });
}

/// Network exception
class NetworkException implements Exception {
  final String message;
  final String? requestId;
  final int? statusCode;

  const NetworkException(
    this.message, {
    this.requestId,
    this.statusCode,
  });

  @override
  String toString() => 'NetworkException: $message';
}

/// Queue statistics
class QueueStats {
  final int queueSize;
  final int activeRequests;
  final int totalRequests;
  final int maxConcurrent;

  const QueueStats({
    required this.queueSize,
    required this.activeRequests,
    required this.totalRequests,
    required this.maxConcurrent,
  });

  Map<String, dynamic> toJson() {
    return {
      'queueSize': queueSize,
      'activeRequests': activeRequests,
      'totalRequests': totalRequests,
      'maxConcurrent': maxConcurrent,
    };
  }
}
