class NetworkSessionState {
  const NetworkSessionState({
    this.clientKey,
    this.jwt,
    this.sessionId,
    this.expiresAt,
    this.claims = const <String>{},
    this.attributes = const <String, dynamic>{},
  });

  final String? clientKey;
  final String? jwt;
  final String? sessionId;
  final DateTime? expiresAt;
  final Set<String> claims;
  final Map<String, dynamic> attributes;

  bool get isAuthenticated => (jwt ?? sessionId) != null;

  NetworkSessionState copyWith({
    String? clientKey,
    String? jwt,
    String? sessionId,
    DateTime? expiresAt,
    Set<String>? claims,
    Map<String, dynamic>? attributes,
  }) {
    return NetworkSessionState(
      clientKey: clientKey ?? this.clientKey,
      jwt: jwt ?? this.jwt,
      sessionId: sessionId ?? this.sessionId,
      expiresAt: expiresAt ?? this.expiresAt,
      claims: claims ?? this.claims,
      attributes: attributes ?? this.attributes,
    );
  }
}
