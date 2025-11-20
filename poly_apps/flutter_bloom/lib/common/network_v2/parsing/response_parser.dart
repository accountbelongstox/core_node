import 'dart:async';
import 'dart:convert';

class ResponseParseContext {
  ResponseParseContext({
    required this.body,
    required this.headers,
    required this.statusCode,
    this.expectedType,
    this.schema,
  });

  final List<int> body;
  final Map<String, String> headers;
  final int statusCode;
  final Type? expectedType;
  final Map<String, dynamic>? schema;

  String get bodyAsString => utf8.decode(body);
}

abstract class ResponseParser<T> {
  FutureOr<T> parse(ResponseParseContext context);
}

class AutoResponseParser implements ResponseParser<dynamic> {
  const AutoResponseParser();

  @override
  FutureOr<dynamic> parse(ResponseParseContext context) {
    try {
      final contentType = context.headers['content-type'] ?? '';
      if (contentType.contains('application/json')) {
        return jsonDecode(context.bodyAsString);
      }
      if (contentType.contains('text/')) {
        return context.bodyAsString;
      }
      // Attempt JSON as a fallback regardless of content type.
      return jsonDecode(context.bodyAsString);
    } catch (_) {
      // Return raw bytes if decoding fails.
      return context.body;
    }
  }
}
