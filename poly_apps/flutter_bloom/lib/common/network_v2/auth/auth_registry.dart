import '../models/auth_requirement.dart';
import 'auth_strategy.dart';

class AuthRegistry {
  final _strategies = <String, AuthStrategy>{};
  AuthStrategy? _fallback;

  void register(AuthStrategy strategy) {
    _strategies[strategy.id] = strategy;
  }

  void setFallback(AuthStrategy strategy) {
    _fallback = strategy;
  }

  AuthStrategy? resolve({String? id, required AuthRequirement requirement}) {
    if (id != null) {
      final strategy = _strategies[id];
      if (strategy != null && strategy.supports(requirement)) {
        return strategy;
      }
    }
    for (final strategy in _strategies.values) {
      if (strategy.supports(requirement)) {
        return strategy;
      }
    }
    if (_fallback != null && _fallback!.supports(requirement)) {
      return _fallback;
    }
    return null;
  }
}
