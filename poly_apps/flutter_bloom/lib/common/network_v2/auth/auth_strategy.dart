import '../models/auth_context.dart';
import '../models/auth_payload.dart';
import '../models/auth_requirement.dart';

abstract class AuthStrategy {
  String get id;
  bool supports(AuthRequirement requirement);
  Future<AuthPayload> build(AuthContext context);
}
