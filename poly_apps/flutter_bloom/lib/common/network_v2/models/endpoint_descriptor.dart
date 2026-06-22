import '../parsing/response_parser.dart';
import 'auth_requirement.dart';
import 'cache_policy.dart';
import 'endpoint_group.dart';
import 'http_method.dart';
import 'retry_policy.dart';

typedef EndpointUriBuilder = Uri Function(Map<String, dynamic> params);
typedef BodyEncoder = dynamic Function(dynamic data);

enum RequestBodyType { json, form, multipart, binary }

typedef ResponseValidator = bool Function(dynamic data);

class EndpointDescriptor {
  EndpointDescriptor({
    required this.id,
    required this.group,
    required this.method,
    required EndpointUriBuilder uriBuilder,
    this.defaultHeaders = const <String, String>{},
    this.bodyType = RequestBodyType.json,
    this.expectResponse = true,
    this.timeout = const Duration(seconds: 30),
    this.cachePolicy,
    this.retryPolicy,
    this.authRequirement,
    this.parser,
    this.validator,
    this.schemaId,
    this.notes,
    BodyEncoder? bodyEncoder,
  })  : uriBuilder = uriBuilder,
        bodyEncoder = bodyEncoder ?? _defaultEncoder;

  final String id;
  final EndpointGroup group;
  final HttpMethod method;
  final EndpointUriBuilder uriBuilder;
  final Map<String, String> defaultHeaders;
  final RequestBodyType bodyType;
  final bool expectResponse;
  final Duration timeout;
  final CachePolicy? cachePolicy;
  final RetryPolicy? retryPolicy;
  final AuthRequirement? authRequirement;
  final ResponseParser? parser;
  final ResponseValidator? validator;
  final String? schemaId;
  final String? notes;
  final BodyEncoder bodyEncoder;

  Uri resolveUri(Map<String, dynamic> params) => uriBuilder(params);
}

dynamic _defaultEncoder(dynamic data) => data;
