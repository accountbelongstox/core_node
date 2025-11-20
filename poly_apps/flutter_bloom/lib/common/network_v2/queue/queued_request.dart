import '../models/network_request.dart';
import '../models/retry_policy.dart';

enum QueuePriority { low, normal, high }

typedef QueueProgressCallback = void Function(double progress);

typedef QueueCompletionCallback = void Function();

class QueuedRequest {
  QueuedRequest({
    required this.request,
    this.priority = QueuePriority.normal,
    this.progress,
    this.onComplete,
    RetryPolicy? retryPolicy,
  }) : retryPolicy = retryPolicy ?? request.options.retryPolicy;

  final NetworkRequest request;
  final QueuePriority priority;
  final QueueProgressCallback? progress;
  final QueueCompletionCallback? onComplete;
  final RetryPolicy? retryPolicy;
  int attempts = 0;
}
