class AuthPayload {
  const AuthPayload({
    this.headers = const <String, String>{},
    this.query = const <String, dynamic>{},
    this.cookies = const <String, String>{},
    this.metadata = const <String, dynamic>{},
  });

  final Map<String, String> headers;
  final Map<String, dynamic> query;
  final Map<String, String> cookies;
  final Map<String, dynamic> metadata;

  AuthPayload merge(AuthPayload other) {
    return AuthPayload(
      headers: <String, String>{...headers, ...other.headers},
      query: <String, dynamic>{...query, ...other.query},
      cookies: <String, String>{...cookies, ...other.cookies},
      metadata: <String, dynamic>{...metadata, ...other.metadata},
    );
  }
}
