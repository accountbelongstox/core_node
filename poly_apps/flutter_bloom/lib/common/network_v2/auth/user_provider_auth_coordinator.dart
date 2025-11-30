// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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

