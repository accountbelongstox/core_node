import 'dart:math';

/// Retry rules for failed requests.
class RetryPolicy {
  const RetryPolicy({
    this.maxAttempts = 3,
    this.initialBackoff = const Duration(milliseconds: 400),
    this.multiplier = 2.0,
    this.maxBackoff = const Duration(seconds: 10),
    this.retryOnStatuses = const {500, 502, 503, 504},
    this.retryOnNetworkError = true,
  }) : assert(maxAttempts >= 1, 'maxAttempts must be >= 1');

  const RetryPolicy.noRetry()
      : maxAttempts = 1,
        initialBackoff = Duration.zero,
        multiplier = 1.0,
        maxBackoff = Duration.zero,
        retryOnStatuses = const {},
        retryOnNetworkError = false;

  final int maxAttempts;
  final Duration initialBackoff;
  final double multiplier;
  final Duration maxBackoff;
  final Set<int> retryOnStatuses;
  final bool retryOnNetworkError;

  Duration backoffForAttempt(int attempt) {
    if (attempt <= 1 || initialBackoff == Duration.zero) {
      return initialBackoff;
    }
    final scaled = initialBackoff.inMilliseconds * pow(multiplier, attempt - 1);
    final capped = min(scaled.round(), maxBackoff.inMilliseconds);
    return Duration(milliseconds: capped);
  }

  RetryPolicy copyWith({
    int? maxAttempts,
    Duration? initialBackoff,
    double? multiplier,
    Duration? maxBackoff,
    Set<int>? retryOnStatuses,
    bool? retryOnNetworkError,
  }) {
    return RetryPolicy(
      maxAttempts: maxAttempts ?? this.maxAttempts,
      initialBackoff: initialBackoff ?? this.initialBackoff,
      multiplier: multiplier ?? this.multiplier,
      maxBackoff: maxBackoff ?? this.maxBackoff,
      retryOnStatuses: retryOnStatuses ?? this.retryOnStatuses,
      retryOnNetworkError: retryOnNetworkError ?? this.retryOnNetworkError,
    );
  }
}
