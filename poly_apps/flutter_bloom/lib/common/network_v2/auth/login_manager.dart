import 'dart:async';

import '../models/network_session_state.dart';

class LoginManager {
  LoginManager({this.cacheDuration = const Duration(hours: 1)})
      : _state = const NetworkSessionState(),
        _controller = StreamController<NetworkSessionState>.broadcast();

  final Duration cacheDuration;
  NetworkSessionState _state;
  DateTime? _cachedAt;
  final StreamController<NetworkSessionState> _controller;

  NetworkSessionState get state => _state;
  Stream<NetworkSessionState> get stream => _controller.stream;

  bool get hasValidSession {
    if (!_state.isAuthenticated) {
      return false;
    }
    if (_state.expiresAt == null) {
      return true;
    }
    return DateTime.now().isBefore(_state.expiresAt!);
  }

  void update(NetworkSessionState next) {
    _state = next;
    _cachedAt = DateTime.now();
    if (!_controller.isClosed) {
      _controller.add(_state);
    }
  }

  void updateFromLogin({
    String? jwt,
    String? refreshToken,
    String? sessionId,
    String? clientKey,
    Set<String>? claims,
    Map<String, dynamic>? attributes,
    Duration? ttl,
  }) {
    final expiresAt = ttl != null ? DateTime.now().add(ttl) : null;
    update(
      NetworkSessionState(
        jwt: jwt ?? _state.jwt,
        sessionId: sessionId ?? _state.sessionId,
        clientKey: clientKey ?? _state.clientKey,
        claims: claims ?? _state.claims,
        attributes: attributes ?? _state.attributes,
        expiresAt: expiresAt ?? _state.expiresAt,
      ),
    );
    if (refreshToken != null) {
      _state = _state.copyWith(
        attributes: <String, dynamic>{
          ..._state.attributes,
          'refreshToken': refreshToken,
        },
      );
    }
  }

  NetworkSessionState? getCached() {
    if (_cachedAt == null) {
      return null;
    }
    final difference = DateTime.now().difference(_cachedAt!);
    if (difference > cacheDuration) {
      return null;
    }
    return _state;
  }

  Future<void> clear() async {
    _state = const NetworkSessionState();
    if (!_controller.isClosed) {
      _controller.add(_state);
    }
  }

  Future<void> dispose() async {
    await _controller.close();
  }
}
