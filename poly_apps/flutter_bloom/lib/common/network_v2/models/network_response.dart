import 'network_error.dart';

class NetworkResponse<T> {
  NetworkResponse({
    required this.statusCode,
    required this.headers,
    required this.duration,
    this.data,
    this.rawBody,
    this.fromCache = false,
    this.requestId,
  });

  final int statusCode;
  final Map<String, String> headers;
  final Duration duration;
  final T? data;
  final dynamic rawBody;
  final bool fromCache;
  final String? requestId;

  bool get isSuccess => statusCode >= 200 && statusCode < 300;
}

class NetworkFailure<T> extends NetworkResponse<T> {
  NetworkFailure({
    required super.statusCode,
    required super.headers,
    required super.duration,
    this.error,
    super.rawBody,
    super.requestId,
    super.fromCache,
  });

  final NetworkError? error;

  @override
  bool get isSuccess => false;
}
