import 'cache_policy.dart';
import 'retry_policy.dart';

class RequestOptions {
  const RequestOptions({
    this.cachePolicy,
    this.retryPolicy,
    this.forceRefresh = false,
    this.skipQueue = false,
    this.useCacheOnly = false,
    this.authStrategyId,
    this.requiredClaims,
    this.attachLoadingState = true,
    this.extra = const <String, dynamic>{},
  });

  final CachePolicy? cachePolicy;
  final RetryPolicy? retryPolicy;
  final bool forceRefresh;
  final bool skipQueue;
  final bool useCacheOnly;
  final String? authStrategyId;
  final Set<String>? requiredClaims;
  final bool attachLoadingState;
  final Map<String, dynamic> extra;

  RequestOptions copyWith({
    CachePolicy? cachePolicy,
    RetryPolicy? retryPolicy,
    bool? forceRefresh,
    bool? skipQueue,
    bool? useCacheOnly,
    String? authStrategyId,
    Set<String>? requiredClaims,
    bool? attachLoadingState,
    Map<String, dynamic>? extra,
  }) {
    return RequestOptions(
      cachePolicy: cachePolicy ?? this.cachePolicy,
      retryPolicy: retryPolicy ?? this.retryPolicy,
      forceRefresh: forceRefresh ?? this.forceRefresh,
      skipQueue: skipQueue ?? this.skipQueue,
      useCacheOnly: useCacheOnly ?? this.useCacheOnly,
      authStrategyId: authStrategyId ?? this.authStrategyId,
      requiredClaims: requiredClaims ?? this.requiredClaims,
      attachLoadingState: attachLoadingState ?? this.attachLoadingState,
      extra: extra ?? this.extra,
    );
  }
}
