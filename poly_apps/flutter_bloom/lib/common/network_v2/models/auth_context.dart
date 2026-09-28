import 'auth_requirement.dart';
import 'network_request.dart';

class AuthContext {
  AuthContext({
    required this.request,
    required this.requirement,
    this.session = const <String, dynamic>{},
    this.extra = const <String, dynamic>{},
  });

  final NetworkRequest request;
  final AuthRequirement requirement;
  final Map<String, dynamic> session;
  final Map<String, dynamic> extra;
}
