import '../models/auth_requirement.dart';
import '../models/network_request.dart';

class AuthCoordinatorResult {
  final Map<String, String> additionalHeaders;
  final Map<String, dynamic> metadata;
  final Map<String, dynamic> sessionUpdate;

  const AuthCoordinatorResult({
    this.additionalHeaders = const <String, String>{},
    this.metadata = const <String, dynamic>{},
    this.sessionUpdate = const <String, dynamic>{},
  });

  bool get isEmpty {
    return additionalHeaders.isEmpty &&
        metadata.isEmpty &&
        sessionUpdate.isEmpty;
  }
}

abstract class AuthCoordinator {
  Future<AuthCoordinatorResult> prepare({
    required AuthRequirement requirement,
    required NetworkRequest request,
  });
}

