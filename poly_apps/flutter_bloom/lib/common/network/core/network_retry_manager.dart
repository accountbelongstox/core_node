import 'dart:async';
import 'dart:math';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'unified_network_client.dart';

/// Smart Retry Manager
/// Adjusts retry strategy based on network conditions
class NetworkRetryManager {
  final Connectivity _connectivity = Connectivity();

  Future<NetworkResponse<T>> executeWithNetworkAwareness<T>(
    Future<NetworkResponse<T>> Function() request, {
    required NetworkRequest requestConfig,
  }) async {
    final connectivityResult = await _connectivity.checkConnectivity();
    final strategy = _getStrategyForConnectivity(connectivityResult, requestConfig);

    return await _executeWithStrategy(request, strategy);
  }

  RetryStrategy _getStrategyForConnectivity(
    ConnectivityResult connectivity,
    NetworkRequest request
  ) {
    // Custom retry count from request takes precedence
    final baseMaxRetries = request.maxRetries ?? 3;

    switch (connectivity) {
      case ConnectivityResult.wifi:
        return RetryStrategy(
          maxRetries: min(baseMaxRetries, 2),
          baseDelay: Duration(milliseconds: 300),
          backoffMultiplier: 1.5,
          jitterFactor: 0.1,
        );

      case ConnectivityResult.mobile:
        return RetryStrategy(
          maxRetries: baseMaxRetries,
          baseDelay: Duration(milliseconds: 800),
          backoffMultiplier: 2.0,
          jitterFactor: 0.2,
        );

      case ConnectivityResult.ethernet:
        return RetryStrategy(
          maxRetries: min(baseMaxRetries, 2),
          baseDelay: Duration(milliseconds: 200),
          backoffMultiplier: 1.2,
          jitterFactor: 0.05,
        );

      case ConnectivityResult.none:
        // No retries for no connection, handle offline
        return RetryStrategy(
          maxRetries: 0,
          baseDelay: Duration.zero,
        );

      default:
        return RetryStrategy(
          maxRetries: baseMaxRetries,
          baseDelay: Duration(seconds: 1),
          backoffMultiplier: 2.0,
          jitterFactor: 0.15,
        );
    }
  }

  Future<NetworkResponse<T>> _executeWithStrategy<T>(
    Future<NetworkResponse<T>> Function() request,
    RetryStrategy strategy,
  ) async {
    int attempts = 0;
    Duration currentDelay = strategy.baseDelay;
    List<String> attemptErrors = [];

    while (attempts <= strategy.maxRetries) {
      try {
        final response = await request();

        // Check if response indicates we should retry
        if (_shouldRetryForResponse(response, attempts, strategy.maxRetries)) {
          attemptErrors.add('HTTP ${response.statusCode}: ${response.message}');
          _logRetryAttempt(attempts + 1, strategy.maxRetries + 1, response.statusCode, currentDelay);
        } else {
          // Success or non-retryable error
          if (attempts > 0) {
            debugPrint('Request succeeded after ${attempts + 1} attempts');
          }
          return response;
        }

      } catch (e) {
        attemptErrors.add(e.toString());

        if (attempts >= strategy.maxRetries) {
          final errorSummary = 'All retry attempts failed: ${attemptErrors.join('; ')}';
          throw NetworkRetryException(errorSummary, attempts + 1, attemptErrors);
        }

        _logRetryAttempt(attempts + 1, strategy.maxRetries + 1, null, currentDelay);
      }

      // Wait before next attempt
      if (attempts < strategy.maxRetries) {
        await Future.delayed(_calculateDelayWithJitter(currentDelay, strategy.jitterFactor));
        currentDelay = Duration(
          milliseconds: (currentDelay.inMilliseconds * strategy.backoffMultiplier).round()
        );
      }

      attempts++;
    }

    // This should never be reached due to the throw above, but just in case
    throw NetworkRetryException(
      'Max retries exceeded: ${attemptErrors.join('; ')}',
      attempts,
      attemptErrors
    );
  }

  bool _shouldRetryForResponse<T>(NetworkResponse<T> response, int currentAttempt, int maxRetries) {
    if (currentAttempt >= maxRetries) return false;

    // Retry on specific HTTP status codes
    const retryableStatusCodes = [
      408, // Request Timeout
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
      522, // Connection Timed Out
      524, // A Timeout Occurred
    ];

    return retryableStatusCodes.contains(response.statusCode);
  }

  Duration _calculateDelayWithJitter(Duration baseDelay, double jitterFactor) {
    if (jitterFactor <= 0) return baseDelay;

    final random = Random();
    final jitterMs = (baseDelay.inMilliseconds * jitterFactor * random.nextDouble()).round();

    return Duration(
      milliseconds: baseDelay.inMilliseconds + jitterMs
    );
  }

  void _logRetryAttempt(int attempt, int totalAttempts, int? statusCode, Duration delay) {
    final statusInfo = statusCode != null ? ' (HTTP $statusCode)' : '';
    debugPrint(
      'Request failed$statusInfo (attempt $attempt/$totalAttempts), retrying in ${delay.inMilliseconds}ms...'
    );
  }

  Future<void> dispose() async {
    // Cleanup resources if needed
  }
}

/// Retry strategy configuration
class RetryStrategy {
  final int maxRetries;
  final Duration baseDelay;
  final double backoffMultiplier;
  final double jitterFactor;

  const RetryStrategy({
    this.maxRetries = 3,
    this.baseDelay = const Duration(seconds: 1),
    this.backoffMultiplier = 2.0,
    this.jitterFactor = 0.1,
  });
}

/// Network retry exception with detailed information
class NetworkRetryException implements Exception {
  final String message;
  final int attemptCount;
  final List<String> attemptErrors;

  const NetworkRetryException(this.message, this.attemptCount, this.attemptErrors);

  @override
  String toString() => 'NetworkRetryException: $message (attempts: $attemptCount)';
}

/// Connectivity monitor for network state changes
class ConnectivityMonitor {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription<ConnectivityResult>? _subscription;
  ConnectivityResult? _currentConnectivity;

  ConnectivityResult? get currentConnectivity => _currentConnectivity;

  Future<void> initialize() async {
    _currentConnectivity = await _connectivity.checkConnectivity();

    _subscription = _connectivity.onConnectivityChanged.listen((result) {
      final previous = _currentConnectivity;
      _currentConnectivity = result;

      if (previous != null && previous != result) {
        _onConnectivityChanged(previous, result);
      }
    });
  }

  void _onConnectivityChanged(ConnectivityResult previous, ConnectivityResult current) {
    debugPrint('Network connectivity changed: $previous -> $current');

    if (previous == ConnectivityResult.none && current != ConnectivityResult.none) {
      debugPrint('Network recovered, triggering offline sync...');
      // Trigger offline request sync
      _triggerOfflineSync();
    }
  }

  void _triggerOfflineSync() {
    // This would trigger the offline manager to sync queued requests
    // Implementation depends on how offline manager is integrated
  }

  Future<bool> waitForNetworkRecovery({Duration? timeout}) async {
    if (_currentConnectivity != ConnectivityResult.none) {
      return true; // Already connected
    }

    final completer = Completer<bool>();
    StreamSubscription<ConnectivityResult>? subscription;

    subscription = _connectivity.onConnectivityChanged.listen((result) {
      if (result != ConnectivityResult.none) {
        subscription?.cancel();
        if (!completer.isCompleted) {
          completer.complete(true);
        }
      }
    });

    // Set timeout if provided
    if (timeout != null) {
      Timer(timeout, () {
        subscription?.cancel();
        if (!completer.isCompleted) {
          completer.complete(false);
        }
      });
    }

    return completer.future;
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}

/// Request priority levels
enum RequestPriority {
  low,
  normal,
  high,
  critical
}