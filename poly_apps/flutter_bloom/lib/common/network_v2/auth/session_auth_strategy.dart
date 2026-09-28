import '../models/auth_context.dart';
import '../models/auth_payload.dart';
import '../models/auth_requirement.dart';
import 'auth_strategy.dart';

typedef SessionProvider = Future<String?> Function();

typedef SessionHeaderProvider = Future<Map<String, String>> Function();

class SessionAuthStrategy implements AuthStrategy {
  SessionAuthStrategy({
    required this.id,
    required this.sessionIdProvider,
    this.cookieName = 'SESSION',
    this.headerProvider,
  });

  @override
  final String id;
  final SessionProvider sessionIdProvider;
  final String cookieName;
  final SessionHeaderProvider? headerProvider;

  @override
  bool supports(AuthRequirement requirement) {
    return requirement.scope == AuthScope.user ||
        requirement.scope == AuthScope.permission ||
        requirement.scope == AuthScope.privileged;
  }

  @override
  Future<AuthPayload> build(AuthContext context) async {
    final sessionId = await sessionIdProvider();
    final headers = await headerProvider?.call() ?? const <String, String>{};
    if (sessionId == null || sessionId.isEmpty) {
      return AuthPayload(headers: headers);
    }
    return AuthPayload(
      headers: headers,
      cookies: <String, String>{cookieName: sessionId},
    );
  }
}
