import '../models/auth_requirement.dart';
import '../models/cache_policy.dart';
import '../models/endpoint_group.dart';
import '../models/retry_policy.dart';

EndpointGroup publicGroup({
  required String id,
  String? description,
  CachePolicy? cachePolicy,
  RetryPolicy? retryPolicy,
}) {
  return EndpointGroup(
    id: id,
    description: description,
    securityLevel: EndpointSecurityLevel.public,
    defaultCachePolicy: cachePolicy,
    defaultRetryPolicy: retryPolicy,
    defaultAuth: const AuthRequirement.none(),
  );
}

EndpointGroup loginGroup({
  required String id,
  String? description,
  CachePolicy? cachePolicy,
  RetryPolicy? retryPolicy,
}) {
  return EndpointGroup(
    id: id,
    description: description,
    securityLevel: EndpointSecurityLevel.login,
    defaultCachePolicy: cachePolicy,
    defaultRetryPolicy: retryPolicy,
    defaultAuth: const AuthRequirement.none(),
  );
}

EndpointGroup authenticatedGroup({
  required String id,
  String? description,
  CachePolicy? cachePolicy,
  RetryPolicy? retryPolicy,
  String? strategyId,
}) {
  return EndpointGroup(
    id: id,
    description: description,
    securityLevel: EndpointSecurityLevel.authenticated,
    defaultCachePolicy: cachePolicy,
    defaultRetryPolicy: retryPolicy,
    defaultAuth: AuthRequirement(
      scope: AuthScope.user,
      strategyId: strategyId,
    ),
  );
}

EndpointGroup permissionGroup({
  required String id,
  String? description,
  CachePolicy? cachePolicy,
  RetryPolicy? retryPolicy,
  String? strategyId,
  Set<String> requiredClaims = const <String>{},
}) {
  return EndpointGroup(
    id: id,
    description: description,
    securityLevel: EndpointSecurityLevel.permission,
    defaultCachePolicy: cachePolicy,
    defaultRetryPolicy: retryPolicy,
    defaultAuth: AuthRequirement(
      scope: AuthScope.permission,
      strategyId: strategyId,
      requiredClaims: requiredClaims,
    ),
  );
}

EndpointGroup privilegedGroup({
  required String id,
  String? description,
  CachePolicy? cachePolicy,
  RetryPolicy? retryPolicy,
  String? strategyId,
  Set<String> requiredClaims = const <String>{},
}) {
  return EndpointGroup(
    id: id,
    description: description,
    securityLevel: EndpointSecurityLevel.privileged,
    defaultCachePolicy: cachePolicy,
    defaultRetryPolicy: retryPolicy,
    defaultAuth: AuthRequirement(
      scope: AuthScope.privileged,
      strategyId: strategyId,
      requiredClaims: requiredClaims,
    ),
  );
}
