import 'dart:async';

import 'loading_state.dart';

class LoadingController {
  LoadingController()
      : _state = const LoadingState(activeRequests: 0, queueDepth: 0),
        _controller = StreamController<LoadingState>.broadcast();

  LoadingState get state => _state;
  Stream<LoadingState> get stream => _controller.stream;

  LoadingState _state;
  final StreamController<LoadingState> _controller;

  void update({int? activeRequests, int? queueDepth}) {
    _state = LoadingState(
      activeRequests: activeRequests ?? _state.activeRequests,
      queueDepth: queueDepth ?? _state.queueDepth,
    );
    if (!_controller.isClosed) {
      _controller.add(_state);
    }
  }

  void incrementActive() {
    update(activeRequests: _state.activeRequests + 1);
  }

  void decrementActive() {
    final next = _state.activeRequests > 0 ? _state.activeRequests - 1 : 0;
    update(activeRequests: next);
  }

  void setQueueDepth(int depth) {
    update(queueDepth: depth);
  }

  Future<void> dispose() async {
    await _controller.close();
  }
}
