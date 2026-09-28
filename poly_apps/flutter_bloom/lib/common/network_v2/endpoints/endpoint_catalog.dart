import '../core/network_manager.dart';
import '../models/auth_requirement.dart';
import '../models/cache_policy.dart';
import '../models/endpoint_descriptor.dart';
import '../models/endpoint_group.dart';
import '../models/http_method.dart';
import '../models/retry_policy.dart';
import '../parsing/response_parser.dart';

class EndpointCatalog {
  EndpointCatalog(this.manager);

  final NetworkManager manager;

  EndpointDescriptor define({
    required String id,
    required EndpointGroup group,
    required HttpMethod method,
    required String path,
    Map<String, String> headers = const <String, String>{},
    RequestBodyType bodyType = RequestBodyType.json,
    bool expectResponse = true,
    Duration timeout = const Duration(seconds: 30),
    CachePolicy? cachePolicy,
    RetryPolicy? retryPolicy,
    AuthRequirement? authRequirement,
    ResponseParser? parser,
    ResponseValidator? validator,
    String? schemaId,
    String? notes,
  }) {
    final descriptor = EndpointDescriptor(
      id: id,
      group: group,
      method: method,
      uriBuilder: (params) => _buildUri(path, params),
      defaultHeaders: headers,
      bodyType: bodyType,
      expectResponse: expectResponse,
      timeout: timeout,
      cachePolicy: cachePolicy,
      retryPolicy: retryPolicy,
      authRequirement: authRequirement,
      parser: parser,
      validator: validator,
      schemaId: schemaId,
      notes: notes,
    );
    manager.registerEndpoint(descriptor);
    return descriptor;
  }

  Uri _buildUri(String pathTemplate, Map<String, dynamic> params) {
    final pathParams = _extractMap(params, 'path');
    final queryParams = _extractMap(params, 'query');

    String path = pathTemplate;
    pathParams.forEach((key, value) {
      final replacement = Uri.encodeComponent(value.toString());
      path = path.replaceAll('{$key}', replacement);
      path = path.replaceAll(':$key', replacement);
    });

    final remainingQuery = <String, dynamic>{};
    params.forEach((key, value) {
      if (key == 'path' || key == 'query') {
        return;
      }
      remainingQuery[key] = value;
    });

    final mergedQuery = <String, dynamic>{
      ...queryParams,
      ...remainingQuery,
    };

    final queryStrings = <String, String>{};
    mergedQuery.forEach((key, value) {
      if (value == null) {
        return;
      }
      queryStrings[key] = value.toString();
    });

    return manager.environment.resolve(path, query: queryStrings);
  }

  Map<String, dynamic> _extractMap(Map<String, dynamic> params, String key) {
    final value = params[key];
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return value.map((key, value) => MapEntry(key.toString(), value));
    }
    return const <String, dynamic>{};
  }
}
