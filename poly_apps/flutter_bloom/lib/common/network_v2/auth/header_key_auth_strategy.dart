import '../models/auth_context.dart';
import '../models/auth_payload.dart';
import '../models/auth_requirement.dart';
import 'auth_strategy.dart';

typedef ClientKeyProvider = Future<String?> Function();

typedef ClaimProvider = Future<Set<String>> Function();

class HeaderKeyAuthStrategy implements AuthStrategy {
  HeaderKeyAuthStrategy({
    required this.id,
    required this.headerName,
    required this.clientKeyProvider,
    this.claimProvider,
    this.fallbackHeaders = const <String, String>{},
  });

  @override
  final String id;
  final String headerName;
  final ClientKeyProvider clientKeyProvider;
  final ClaimProvider? claimProvider;
  final Map<String, String> fallbackHeaders;

  @override
  bool supports(AuthRequirement requirement) {
    return requirement.scope == AuthScope.client ||
        requirement.scope == AuthScope.privileged;
  }

  @override
  Future<AuthPayload> build(AuthContext context) async {
    final key = await clientKeyProvider();
    if (key == null || key.isEmpty) {
      return AuthPayload(headers: fallbackHeaders);
    }
    final claims = await claimProvider?.call();
    return AuthPayload(
      headers: <String, String>{headerName: key, ...fallbackHeaders},
      metadata: <String, dynamic>{
        if (claims != null) 'claims': claims,
      },
    );
  }
}
