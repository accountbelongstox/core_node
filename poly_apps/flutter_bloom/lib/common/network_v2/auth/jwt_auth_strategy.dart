import '../models/auth_context.dart';
import '../models/auth_payload.dart';
import '../models/auth_requirement.dart';
import 'auth_strategy.dart';

typedef TokenProvider = Future<String?> Function();

typedef SessionClaimProvider = Future<Map<String, dynamic>> Function();

class JwtAuthStrategy implements AuthStrategy {
  JwtAuthStrategy({
    required this.id,
    required this.tokenProvider,
    this.prefix = 'Bearer',
    this.extraHeaders = const <String, String>{},
    this.claimProvider,
  });

  @override
  final String id;
  final TokenProvider tokenProvider;
  final String prefix;
  final Map<String, String> extraHeaders;
  final SessionClaimProvider? claimProvider;

  @override
  bool supports(AuthRequirement requirement) {
    return requirement.scope == AuthScope.user ||
        requirement.scope == AuthScope.permission ||
        requirement.scope == AuthScope.privileged;
  }

  @override
  Future<AuthPayload> build(AuthContext context) async {
    final token = await tokenProvider();
    if (token == null || token.isEmpty) {
      return const AuthPayload();
    }
    final claims = await claimProvider?.call();
    return AuthPayload(
      headers: <String, String>{
        'Authorization': '$prefix $token',
        ...extraHeaders,
      },
      metadata: <String, dynamic>{
        if (claims != null) ...claims,
      },
    );
  }
}
