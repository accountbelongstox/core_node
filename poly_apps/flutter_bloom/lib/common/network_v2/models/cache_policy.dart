typedef CacheKeyBuilder = String Function(
  String endpointId,
  Map<String, dynamic> params,
  dynamic body,
);

/// Cache configuration for a request or endpoint.
class CachePolicy {
  const CachePolicy({
    this.enabled = true,
    this.ttl = const Duration(minutes: 5),
    this.varyByHeaders = const <String>{},
    this.allowStaleOnNetworkError = false,
    this.cacheKeyBuilder,
  });

  const CachePolicy.disabled()
      : enabled = false,
        ttl = Duration.zero,
        varyByHeaders = const <String>{},
        allowStaleOnNetworkError = false,
        cacheKeyBuilder = null;

  final bool enabled;
  final Duration ttl;
  final Set<String> varyByHeaders;
  final bool allowStaleOnNetworkError;
  final CacheKeyBuilder? cacheKeyBuilder;

  CachePolicy copyWith({
    bool? enabled,
    Duration? ttl,
    Set<String>? varyByHeaders,
    bool? allowStaleOnNetworkError,
    CacheKeyBuilder? cacheKeyBuilder,
  }) {
    return CachePolicy(
      enabled: enabled ?? this.enabled,
      ttl: ttl ?? this.ttl,
      varyByHeaders: varyByHeaders ?? this.varyByHeaders,
      allowStaleOnNetworkError:
          allowStaleOnNetworkError ?? this.allowStaleOnNetworkError,
      cacheKeyBuilder: cacheKeyBuilder ?? this.cacheKeyBuilder,
    );
  }
}
