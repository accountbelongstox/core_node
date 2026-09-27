import '../../provider_status/user_provider.dart';
import '../models/auth_requirement.dart';
import '../models/network_request.dart';
import 'auth_coordinator.dart';

class UserProviderAuthCoordinator implements AuthCoordinator {
  final EnhancedUserProvider provider;

  UserProviderAuthCoordinator({required this.provider});

  @override
  Future<AuthCoordinatorResult> prepare({
    required AuthRequirement requirement,
    required NetworkRequest request,
  }) async {
    await provider.ensureInitialized();
    final Set<String> claims = requirement.requiredClaims.isNotEmpty
        ? requirement.requiredClaims
        : (request.options.requiredClaims ?? const <String>{});

    if (claims.isNotEmpty && requirement.isRequired) {
      await provider.ensurePermissionClaims(
        claims,
        scope: requirement.scope.name,
      );
    }

    final AuthAugmentationBundle bundle = provider.buildNetworkAugmentation(
      scope: requirement.scope.name,
      claims: claims,
    );

    if (bundle.headers.isEmpty &&
        bundle.metadata.isEmpty &&
        bundle.sessionUpdate.isEmpty) {
      return const AuthCoordinatorResult();
    }

    return AuthCoordinatorResult(
      additionalHeaders: bundle.headers,
      metadata: bundle.metadata,
      sessionUpdate: bundle.sessionUpdate,
    );
  }
}

