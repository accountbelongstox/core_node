import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/http_method.dart';

class HttpRequestPayload {
  HttpRequestPayload({
    required this.method,
    required this.uri,
    required this.headers,
    this.body,
    this.timeout = const Duration(seconds: 30),
  });

  final HttpMethod method;
  final Uri uri;
  final Map<String, String> headers;
  final dynamic body;
  final Duration timeout;

  String get methodName => method.name.toUpperCase();
}

class HttpRawResponse {
  HttpRawResponse({
    required this.statusCode,
    required this.headers,
    required this.bodyBytes,
    required this.duration,
  });

  final int statusCode;
  final Map<String, String> headers;
  final List<int> bodyBytes;
  final Duration duration;
}

abstract class HttpClientAdapter {
  Future<HttpRawResponse> send(HttpRequestPayload payload);
  Future<void> close();
}

class DefaultHttpClientAdapter implements HttpClientAdapter {
  DefaultHttpClientAdapter({http.Client? client})
      : _client = client ?? http.Client();

  final http.Client _client;

  @override
  Future<HttpRawResponse> send(HttpRequestPayload payload) async {
    final request = http.Request(payload.methodName, payload.uri);
    request.headers.addAll(payload.headers);
    if (payload.body != null) {
      if (payload.body is List<int>) {
        request.bodyBytes = payload.body as List<int>;
      } else if (payload.body is String) {
        request.body = payload.body as String;
      } else if (payload.body is Map) {
        request.body = jsonEncode(payload.body);
        request.headers.putIfAbsent('Content-Type', () => 'application/json');
      } else {
        request.body = payload.body.toString();
      }
    }

    final stopwatch = Stopwatch()..start();
    final streamed = await _client.send(request).timeout(payload.timeout);
    final response = await http.Response.fromStream(streamed);
    stopwatch.stop();

    return HttpRawResponse(
      statusCode: response.statusCode,
      headers: response.headers,
      bodyBytes: response.bodyBytes,
      duration: stopwatch.elapsed,
    );
  }

  @override
  Future<void> close() async {
    _client.close();
  }
}
