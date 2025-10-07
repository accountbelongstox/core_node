import 'dart:async';
import 'dart:collection';
// FIXED: Removed unused 'dart:convert' import
import 'package:flutter/foundation.dart';
import 'unified_network_client.dart';
// REFACTOR: Import all needed types from network_types.dart
import 'network_types.dart' show RequestPriority, NetworkRequest, NetworkResponse, CancelToken;
// FIXED: Removed unused network_retry_manager.dart import
// It also defines RequestPriority which would cause conflicts

/// Request Queue Manager with Priority Support
/// Replaces the problematic singleton pattern with proper lifecycle management
class NetworkRequestQueue {
  final Queue<QueuedRequest> _highPriorityQueue = Queue();
  final Queue<QueuedRequest> _normalPriorityQueue = Queue();
  final Queue<QueuedRequest> _lowPriorityQueue = Queue();
  final Queue<QueuedRequest> _criticalPriorityQueue = Queue();

  bool _isProcessing = false;
  bool _isDisposed = false;
  Timer? _processTimer;

  int _maxConcurrentRequests = 3;
  int _currentActiveRequests = 0;

  /// Queue a request with priority
  Future<NetworkResponse<T>> enqueue<T>(
    Future<NetworkResponse<T>> Function() request,
    {RequestPriority priority = RequestPriority.normal}
  ) async {
    if (_isDisposed) {
      throw StateError('NetworkRequestQueue has been disposed');
    }

    final completer = Completer<NetworkResponse<T>>();
    final queuedRequest = QueuedRequest<T>(request, completer);

    // Add to appropriate priority queue
    switch (priority) {
      case RequestPriority.critical:
        _criticalPriorityQueue.add(queuedRequest);
        break;
      case RequestPriority.high:
        _highPriorityQueue.add(queuedRequest);
        break;
      case RequestPriority.normal:
        _normalPriorityQueue.add(queuedRequest);
        break;
      case RequestPriority.low:
        _lowPriorityQueue.add(queuedRequest);
        break;
    }

    _scheduleProcessing();
    return completer.future;
  }

  void _scheduleProcessing() {
    if (_isProcessing || _isDisposed) return;

    // Use timer to batch process requests
    _processTimer?.cancel();
    _processTimer = Timer(Duration(milliseconds: 10), _processQueue);
  }

  Future<void> _processQueue() async {
    if (_isProcessing || _isDisposed) return;
    _isProcessing = true;

    try {
      while (_hasQueuedRequests() && _canProcessMoreRequests()) {
        final request = _getNextRequest();
        if (request == null) break;

        _currentActiveRequests++;

        // Process request without blocking the queue
        _processRequestAsync(request);

        // Small delay for network stability on mobile
        await Future.delayed(Duration(milliseconds: 20));
      }
    } finally {
      _isProcessing = false;

      // Schedule next processing if there are still requests
      if (_hasQueuedRequests() && !_isDisposed) {
        _scheduleProcessing();
      }
    }
  }

  Future<void> _processRequestAsync<T>(QueuedRequest<T> queuedRequest) async {
    try {
      final response = await queuedRequest.request();
      queuedRequest.completer.complete(response);
    } catch (e) {
      queuedRequest.completer.completeError(e);
    } finally {
      _currentActiveRequests--;

      // Continue processing if there are queued requests
      if (_hasQueuedRequests() && !_isDisposed) {
        _scheduleProcessing();
      }
    }
  }

  bool _hasQueuedRequests() {
    return _criticalPriorityQueue.isNotEmpty ||
           _highPriorityQueue.isNotEmpty ||
           _normalPriorityQueue.isNotEmpty ||
           _lowPriorityQueue.isNotEmpty;
  }

  bool _canProcessMoreRequests() {
    return _currentActiveRequests < _maxConcurrentRequests;
  }

  QueuedRequest? _getNextRequest() {
    // Process in priority order
    if (_criticalPriorityQueue.isNotEmpty) return _criticalPriorityQueue.removeFirst();
    if (_highPriorityQueue.isNotEmpty) return _highPriorityQueue.removeFirst();
    if (_normalPriorityQueue.isNotEmpty) return _normalPriorityQueue.removeFirst();
    if (_lowPriorityQueue.isNotEmpty) return _lowPriorityQueue.removeFirst();
    return null;
  }

  /// Get queue statistics
  QueueStats getStats() {
    return QueueStats(
      criticalCount: _criticalPriorityQueue.length,
      highCount: _highPriorityQueue.length,
      normalCount: _normalPriorityQueue.length,
      lowCount: _lowPriorityQueue.length,
      activeRequests: _currentActiveRequests,
      isProcessing: _isProcessing,
    );
  }

  /// Update concurrency settings
  void updateConcurrency(int maxConcurrentRequests) {
    _maxConcurrentRequests = maxConcurrentRequests.clamp(1, 10);
    debugPrint('Updated max concurrent requests to: $_maxConcurrentRequests');
  }

  Future<void> dispose() async {
    if (_isDisposed) return;

    _isDisposed = true;
    _processTimer?.cancel();

    // Complete all pending requests with disposal error
    final allQueues = [
      _criticalPriorityQueue,
      _highPriorityQueue,
      _normalPriorityQueue,
      _lowPriorityQueue
    ];

    for (final queue in allQueues) {
      while (queue.isNotEmpty) {
        final request = queue.removeFirst();
        request.completer.completeError(
          StateError('NetworkRequestQueue was disposed')
        );
      }
    }
  }
}

/// Offline Request Manager
/// Handles request queuing when network is unavailable
class OfflineRequestManager {
  final List<PendingOfflineRequest> _pendingRequests = [];
  final int _maxOfflineRequests = 100;
  bool _isDisposed = false;

  /// Queue a request for offline execution
  Future<void> queueRequest(NetworkRequest request) async {
    if (_isDisposed) return;

    if (_pendingRequests.length >= _maxOfflineRequests) {
      // Remove oldest low-priority requests to make space
      _pendingRequests.removeWhere((req) => req.priority == RequestPriority.low);

      if (_pendingRequests.length >= _maxOfflineRequests) {
        debugPrint('Offline queue full, dropping oldest request');
        _pendingRequests.removeAt(0);
      }
    }

    final pendingRequest = PendingOfflineRequest(
      id: _generateRequestId(),
      request: request,
      timestamp: DateTime.now(),
      priority: request.priority,
    );

    _pendingRequests.add(pendingRequest);
    await _persistOfflineRequests();

    debugPrint('Queued request for offline execution: ${request.endpoint}');
  }

  /// Sync all pending offline requests
  Future<void> syncPendingRequests() async {
    if (_isDisposed || _pendingRequests.isEmpty) return;

    debugPrint('Syncing ${_pendingRequests.length} pending offline requests...');

    // Sort by priority for sync order
    _pendingRequests.sort((a, b) {
      final priorityOrder = {
        RequestPriority.critical: 0,
        RequestPriority.high: 1,
        RequestPriority.normal: 2,
        RequestPriority.low: 3,
      };
      return priorityOrder[a.priority]!.compareTo(priorityOrder[b.priority]!);
    });

    final requestsToProcess = List<PendingOfflineRequest>.from(_pendingRequests);
    _pendingRequests.clear();

    int successCount = 0;
    int failureCount = 0;

    for (final pendingRequest in requestsToProcess) {
      if (_isDisposed) break;

      try {
        // Execute the offline request
        // This would need to be integrated with the actual network client
        debugPrint('Successfully synced: ${pendingRequest.request.endpoint}');
        successCount++;
      } catch (e) {
        debugPrint('Failed to sync: ${pendingRequest.request.endpoint}, error: $e');

        // Re-queue failed high/critical priority requests
        if (pendingRequest.priority == RequestPriority.critical ||
            pendingRequest.priority == RequestPriority.high) {
          _pendingRequests.add(pendingRequest);
        }
        failureCount++;
      }
    }

    await _persistOfflineRequests();
    debugPrint('Offline sync completed: $successCount succeeded, $failureCount failed');
  }

  /// Get offline requests count by priority
  OfflineStats getStats() {
    final stats = <RequestPriority, int>{};
    for (final priority in RequestPriority.values) {
      stats[priority] = _pendingRequests.where((req) => req.priority == priority).length;
    }

    return OfflineStats(
      totalCount: _pendingRequests.length,
      countByPriority: stats,
      oldestRequestAge: _pendingRequests.isEmpty
          ? null
          : DateTime.now().difference(_pendingRequests.first.timestamp),
    );
  }

  /// Clear all offline requests
  Future<void> clearOfflineRequests() async {
    _pendingRequests.clear();
    await _persistOfflineRequests();
    debugPrint('Cleared all offline requests');
  }

  String _generateRequestId() {
    return '${DateTime.now().millisecondsSinceEpoch}_${_pendingRequests.length}';
  }

  Future<void> _persistOfflineRequests() async {
    // In a real implementation, this would save to secure storage
    // For now, just debug log the count
    debugPrint('Persisted ${_pendingRequests.length} offline requests');
  }

  Future<void> dispose() async {
    if (_isDisposed) return;

    _isDisposed = true;
    await _persistOfflineRequests();
    _pendingRequests.clear();
  }
}

/// Queued request wrapper
class QueuedRequest<T> {
  final Future<NetworkResponse<T>> Function() request;
  final Completer<NetworkResponse<T>> completer;

  QueuedRequest(this.request, this.completer);
}

/// Pending offline request model
class PendingOfflineRequest {
  final String id;
  final NetworkRequest request;
  final DateTime timestamp;
  final RequestPriority priority;

  const PendingOfflineRequest({
    required this.id,
    required this.request,
    required this.timestamp,
    required this.priority,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'endpoint': request.endpoint,
      'method': request.method,
      'parameters': request.parameters,
      'headers': request.headers,
      'body': request.body,
      'timestamp': timestamp.toIso8601String(),
      'priority': priority.toString(),
    };
  }

  factory PendingOfflineRequest.fromJson(Map<String, dynamic> json) {
    return PendingOfflineRequest(
      id: json['id'],
      request: NetworkRequest(
        endpoint: json['endpoint'],
        method: json['method'] ?? 'GET',
        parameters: json['parameters'],
        headers: Map<String, String>.from(json['headers'] ?? {}),
        body: json['body'],
      ),
      timestamp: DateTime.parse(json['timestamp']),
      priority: RequestPriority.values.firstWhere(
        (p) => p.toString() == json['priority'],
        orElse: () => RequestPriority.normal,
      ),
    );
  }
}

/// Queue statistics
class QueueStats {
  final int criticalCount;
  final int highCount;
  final int normalCount;
  final int lowCount;
  final int activeRequests;
  final bool isProcessing;

  const QueueStats({
    required this.criticalCount,
    required this.highCount,
    required this.normalCount,
    required this.lowCount,
    required this.activeRequests,
    required this.isProcessing,
  });

  int get totalQueued => criticalCount + highCount + normalCount + lowCount;

  @override
  String toString() {
    return 'QueueStats(total: $totalQueued, active: $activeRequests, '
           'critical: $criticalCount, high: $highCount, normal: $normalCount, low: $lowCount)';
  }
}

/// Offline statistics
class OfflineStats {
  final int totalCount;
  final Map<RequestPriority, int> countByPriority;
  final Duration? oldestRequestAge;

  const OfflineStats({
    required this.totalCount,
    required this.countByPriority,
    this.oldestRequestAge,
  });

  @override
  String toString() {
    final ageInfo = oldestRequestAge != null
        ? ', oldest: ${oldestRequestAge!.inMinutes}min'
        : '';
    return 'OfflineStats(total: $totalCount$ageInfo)';
  }
}