import 'dart:async';

import 'queued_request.dart';

typedef RequestRunner<T> = Future<T> Function();

class RequestQueue {
  RequestQueue({this.maxConcurrent = 3});

  final int maxConcurrent;
  final _pending = <_QueuedTask<dynamic>>[];
  int _active = 0;

  int get pendingCount => _pending.length;
  int get activeCount => _active;

  Future<T> schedule<T>(QueuedRequest request, RequestRunner<T> runner) {
    final task = _QueuedTask<T>(request: request, runner: runner);
    _pending.add(task);
    _pending.sort(
        (a, b) => b.request.priority.index.compareTo(a.request.priority.index));
    _tryDequeue();
    return task.completer.future;
  }

  void _tryDequeue() {
    if (_active >= maxConcurrent) {
      return;
    }
    if (_pending.isEmpty) {
      return;
    }
    final task = _pending.removeAt(0);
    _active += 1;
    _runTask(task);
  }

  void _runTask(_QueuedTask<dynamic> task) {
    task.runner().then((value) {
      task.completer.complete(value);
    }).catchError((error, stackTrace) {
      task.completer.completeError(error, stackTrace);
    }).whenComplete(() {
      task.request.onComplete?.call();
      _active -= 1;
      _tryDequeue();
    });
  }
}

class _QueuedTask<T> {
  _QueuedTask({required this.request, required this.runner})
      : completer = Completer<T>();

  final QueuedRequest request;
  final RequestRunner<T> runner;
  final Completer<T> completer;
}
