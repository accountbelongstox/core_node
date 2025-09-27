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
    required int statusCode,
    required Map<String, String> headers,
    required Duration duration,
    this.error,
    dynamic rawBody,
    String? requestId,
    bool fromCache = false,
  }) : super(
          statusCode: statusCode,
          headers: headers,
          duration: duration,
          rawBody: rawBody,
          requestId: requestId,
          fromCache: fromCache,
        );

  final NetworkError? error;

  @override
  bool get isSuccess => false;
}
