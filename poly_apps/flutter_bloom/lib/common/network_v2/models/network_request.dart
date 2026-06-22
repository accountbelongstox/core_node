import '../utils/id_generator.dart';
import 'endpoint_descriptor.dart';
import 'request_options.dart';

class NetworkRequest {
  NetworkRequest({
    required this.endpoint,
    Map<String, dynamic>? params,
    dynamic body,
    Map<String, String>? headers,
    RequestOptions? options,
    String? requestId,
  })  : params = params ?? <String, dynamic>{},
        body = body,
        headers = headers ?? <String, String>{},
        options = options ?? const RequestOptions(),
        requestId = requestId ?? generateRequestId();

  final EndpointDescriptor endpoint;
  final Map<String, dynamic> params;
  final dynamic body;
  final Map<String, String> headers;
  final RequestOptions options;
  final String requestId;

  Uri get uri => endpoint.resolveUri(params);
}
