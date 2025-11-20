import '../models/auth_context.dart';
import '../models/auth_payload.dart';
import '../models/auth_requirement.dart';
import 'auth_strategy.dart';

class CompositeAuthStrategy implements AuthStrategy {
  CompositeAuthStrategy(
      {required this.id, required List<AuthStrategy> strategies})
      : strategies = List<AuthStrategy>.unmodifiable(strategies);

  @override
  final String id;
  final List<AuthStrategy> strategies;

  @override
  bool supports(AuthRequirement requirement) {
    return strategies.any((strategy) => strategy.supports(requirement));
  }

  @override
  Future<AuthPayload> build(AuthContext context) async {
    AuthPayload payload = const AuthPayload();
    for (final strategy in strategies) {
      if (!strategy.supports(context.requirement)) {
        continue;
      }
      final next = await strategy.build(context);
      payload = payload.merge(next);
    }
    return payload;
  }
}
