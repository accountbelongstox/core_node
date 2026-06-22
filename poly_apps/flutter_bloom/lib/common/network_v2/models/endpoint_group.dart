import 'auth_requirement.dart';
import 'cache_policy.dart';
import 'retry_policy.dart';

enum EndpointSecurityLevel {
  public,
  login,
  authenticated,
  permission,
  privileged,
}

class EndpointGroup {
  const EndpointGroup({
    required this.id,
    required this.securityLevel,
    this.description,
    this.defaultAuth,
    this.defaultCachePolicy,
    this.defaultRetryPolicy,
    this.metadata = const <String, dynamic>{},
  });

  final String id;
  final EndpointSecurityLevel securityLevel;
  final String? description;
  final AuthRequirement? defaultAuth;
  final CachePolicy? defaultCachePolicy;
  final RetryPolicy? defaultRetryPolicy;
  final Map<String, dynamic> metadata;
}
