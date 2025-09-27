enum AuthScope {
  none,
  client,
  user,
  permission,
  privileged,
}

class AuthRequirement {
  const AuthRequirement({
    required this.scope,
    this.strategyId,
    this.requiredClaims = const <String>{},
  });

  const AuthRequirement.none()
      : scope = AuthScope.none,
        strategyId = null,
        requiredClaims = const <String>{};

  final AuthScope scope;
  final String? strategyId;
  final Set<String> requiredClaims;

  bool get isRequired => scope != AuthScope.none;
}
