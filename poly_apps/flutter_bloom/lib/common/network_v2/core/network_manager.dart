import 'dart:async';
import 'dart:convert';

import '../auth/auth_coordinator.dart';
import '../auth/auth_registry.dart';
import '../auth/login_manager.dart';
import '../auth/user_provider_auth_coordinator.dart';
import '../../cache_manager/cache_manager.dart';
import '../../network/core/network_types.dart' as network_types;
import '../loading/loading_controller.dart';
import '../models/auth_context.dart';
import '../models/auth_requirement.dart';
import '../models/cache_policy.dart';
import '../models/endpoint_descriptor.dart';
import '../models/endpoint_group.dart';
import '../models/network_environment.dart';
import '../models/network_error.dart';
import '../models/network_request.dart';
import '../models/request_options.dart';
import '../models/retry_policy.dart';
import '../parsing/response_parser.dart';
import '../parsing/schema_registry.dart';
import '../queue/queued_request.dart';
import '../queue/request_queue.dart';
import '../utils/id_generator.dart';
import 'http_client.dart';
import '../../provider_status/user_provider.dart';

class NetworkManager {
  NetworkManager({
    required this.environment,
    AuthRegistry? authRegistry,
    CacheManager? cacheManager,
    SchemaRegistry? schemaRegistry,
    HttpClientAdapter? httpClient,
    RequestQueue? requestQueue,
    LoadingController? loadingController,
    LoginManager? loginManager,
    this.defaultRetryPolicy = const RetryPolicy(),
    this.defaultCachePolicy = const CachePolicy(),
    AuthCoordinator? authCoordinator,
    EnhancedUserProvider? userProvider,
    ResponseParser? autoParser,
  })  : authRegistry = authRegistry ?? AuthRegistry(),
        cacheManager = cacheManager ?? CacheManager.instance,
        schemaRegistry = schemaRegistry ?? SchemaRegistry(),
        httpClient = httpClient ?? DefaultHttpClientAdapter(),
        requestQueue = requestQueue ?? RequestQueue(),
        loadingController = loadingController ?? LoadingController(),
        loginManager = loginManager ?? LoginManager(),
        authCoordinator = authCoordinator ??
            (userProvider != null
                ? UserProviderAuthCoordinator(provider: userProvider)
                : null),
        autoParser = autoParser ?? const AutoResponseParser();

  final NetworkEnvironment environment;
  final AuthRegistry authRegistry;
  final CacheManager cacheManager;
  final SchemaRegistry schemaRegistry;
  final HttpClientAdapter httpClient;
  final RequestQueue requestQueue;
  final LoadingController loadingController;
  final LoginManager loginManager;
  final RetryPolicy defaultRetryPolicy;
  final CachePolicy defaultCachePolicy;
  final ResponseParser autoParser;
  final AuthCoordinator? authCoordinator;

  final _endpoints = <String, EndpointDescriptor>{};
  final _groups = <String, EndpointGroup>{};

  void registerGroup(EndpointGroup group) {
    _groups[group.id] = group;
  }

  void registerEndpoint(EndpointDescriptor descriptor) {
    _endpoints[descriptor.id] = descriptor;
    registerGroup(descriptor.group);
  }

  EndpointDescriptor? resolveEndpoint(String id) => _endpoints[id];

  Future<network_types.NetworkResponse<T>> requestById<T>(
    String endpointId, {
    Map<String, dynamic>? params,
    dynamic body,
    Map<String, String>? headers,
    RequestOptions? options,
  }) async {
    final descriptor = resolveEndpoint(endpointId);
    if (descriptor == null) {
      throw ArgumentError('Endpoint ' + endpointId + ' not registered');
    }
    return execute<T>(
      NetworkRequest(
        endpoint: descriptor,
        params: params,
        body: body,
        headers: headers,
        options: options,
        requestId: generateRequestId(),
      ),
    );
  }

  Future<network_types.NetworkResponse<T>> execute<T>(
      NetworkRequest request) async {
    final cachePolicy = _resolveCachePolicy(request);
    final cacheKey =
        cachePolicy.enabled ? _buildCacheKey(request, cachePolicy) : null;
    CacheEntry? staleEntry;

    if (!request.options.forceRefresh &&
        cachePolicy.enabled &&
        cacheKey != null) {
      final cached = await cacheManager.getEntry('network', cacheKey);
      if (cached != null && !cached.isExpired) {
        return _fromCache<T>(request, cached);
      }
      staleEntry = cached;
      if (request.options.useCacheOnly) {
        throw NetworkError(
            message: 'Cache miss for request ' + request.requestId);
      }
    }

    final priority = request.options.extra['queuePriority'] is QueuePriority
        ? request.options.extra['queuePriority'] as QueuePriority
        : QueuePriority.normal;

    if (request.options.skipQueue) {
      return _perform<T>(request, cachePolicy, cacheKey, staleEntry);
    }

    loadingController.setQueueDepth(requestQueue.pendingCount + 1);
    final queued = QueuedRequest(request: request, priority: priority);
    return requestQueue.schedule<network_types.NetworkResponse<T>>(queued,
        () async {
      loadingController.setQueueDepth(requestQueue.pendingCount);
      return _perform<T>(request, cachePolicy, cacheKey, staleEntry);
    });
  }

  Future<network_types.NetworkResponse<T>> _perform<T>(
    NetworkRequest request,
    CachePolicy cachePolicy,
    String? cacheKey,
    CacheEntry? staleEntry,
  ) async {
    loadingController.incrementActive();
    try {
      final retryPolicy = _resolveRetryPolicy(request);
      final requirement = _resolveAuthRequirement(request);
      return await _attemptWithRetry<T>(
        request: request,
        cachePolicy: cachePolicy,
        cacheKey: cacheKey,
        stale: staleEntry,
        retryPolicy: retryPolicy,
        requirement: requirement,
      );
    } finally {
      loadingController.decrementActive();
    }
  }

  Future<network_types.NetworkResponse<T>> _attemptWithRetry<T>({
    required NetworkRequest request,
    required CachePolicy cachePolicy,
    required String? cacheKey,
    required CacheEntry? stale,
    required RetryPolicy retryPolicy,
    required AuthRequirement requirement,
  }) async {
    var attempt = 0;
    NetworkError? lastError;

    while (attempt < retryPolicy.maxAttempts) {
      attempt += 1;
      try {
        final response = await _sendOnce<T>(
          request: request,
          cachePolicy: cachePolicy,
          cacheKey: cacheKey,
          requirement: requirement,
        );

        if (!response.isSuccess &&
            response.statusCode != null &&
            _shouldRetryStatus(response.statusCode!, retryPolicy, attempt)) {
          await _sleep(retryPolicy.backoffForAttempt(attempt));
          continue;
        }
        return response;
      } on NetworkError catch (error) {
        lastError = error;
        final canRetryNetwork =
            retryPolicy.retryOnNetworkError && error.isNetworkError;
        final canRetryStatus = error.statusCode != null &&
            _shouldRetryStatus(error.statusCode!, retryPolicy, attempt);

        if (attempt >= retryPolicy.maxAttempts ||
            (!canRetryNetwork && !canRetryStatus)) {
          if (cachePolicy.allowStaleOnNetworkError && stale != null) {
            return _fromCache<T>(request, stale, isStale: true);
          }
          throw error;
        }
        await _sleep(retryPolicy.backoffForAttempt(attempt));
      }
    }

    throw lastError ?? NetworkError(message: 'Unknown network failure');
  }

  Future<void> _sleep(Duration duration) async {
    if (duration == Duration.zero) {
      return;
    }
    await Future<void>.delayed(duration);
  }

  bool _shouldRetryStatus(
      int statusCode, RetryPolicy retryPolicy, int attempt) {
    if (attempt >= retryPolicy.maxAttempts) {
      return false;
    }
    return retryPolicy.retryOnStatuses.contains(statusCode);
  }

  Future<network_types.NetworkResponse<T>> _sendOnce<T>({
    required NetworkRequest request,
    required CachePolicy cachePolicy,
    required String? cacheKey,
    required AuthRequirement requirement,
  }) async {
    final descriptor = request.endpoint;
    final headers = <String, String>{
      ...descriptor.defaultHeaders,
      ...request.headers,
    };

    final authPayload = await _applyAuth(headers, request, requirement);
    final uri = descriptor.resolveUri(authPayload.params);
    final body = _prepareBody(descriptor, headers, authPayload.body);

    final httpPayload = HttpRequestPayload(
      method: descriptor.method,
      uri: uri,
      headers: headers,
      body: body,
      timeout: descriptor.timeout,
    );

    try {
      final raw = await httpClient.send(httpPayload);
      final schema = schemaRegistry.resolveSchema(descriptor.schemaId);
      final parser = descriptor.parser ??
          schemaRegistry.resolveParser(descriptor.schemaId) ??
          autoParser;
      final context = ResponseParseContext(
        body: raw.bodyBytes,
        headers: raw.headers,
        statusCode: raw.statusCode,
        expectedType: T == dynamic ? null : T,
        schema: schema,
      );

      dynamic parsed;
      try {
        parsed = await parser.parse(context);
      } catch (_) {
        parsed = await autoParser.parse(context);
      }

      if (descriptor.validator != null && !descriptor.validator!(parsed)) {
        final fallback = await autoParser.parse(context);
        if (descriptor.validator!(fallback)) {
          parsed = fallback;
        } else {
          throw NetworkError(
              message: 'Response validation failed',
              statusCode: raw.statusCode);
        }
      }

      if (raw.statusCode >= 200 && raw.statusCode < 300) {
        if (cachePolicy.enabled && cacheKey != null) {
          await cacheManager.put('network', cacheKey, parsed,
              ttl: cachePolicy.ttl,
              metadata: {
                'statusCode': raw.statusCode,
                'headers': raw.headers,
              });
        }
        _maybeUpdateLogin(descriptor, parsed);
        final typed = _castResponseData<T>(parsed);
        return network_types.NetworkResponse<T>(
          data: typed,
          statusCode: raw.statusCode,
          headers: raw.headers,
          isFromCache: false,
          isStale: false,
          timestamp: DateTime.now(),
          latency: raw.duration,
          metadata: {
            'requestId': request.requestId,
            'rawBody': parsed,
          },
        );
      }

      final error = NetworkError(
        message: _extractErrorMessage(parsed, raw),
        statusCode: raw.statusCode,
        details: parsed is Map<String, dynamic> ? parsed : null,
      );

      throw error;
    } on TimeoutException catch (error) {
      throw NetworkError(
          message: 'Request timed out', original: error, isNetworkError: true);
    } on NetworkError {
      rethrow;
    } catch (error) {
      throw NetworkError(
          message: 'Network failure', original: error, isNetworkError: true);
    }
  }

  Future<_AuthPayloadContext> _applyAuth(
    Map<String, String> headers,
    NetworkRequest request,
    AuthRequirement requirement,
  ) async {
    final Map<String, dynamic> params = <String, dynamic>{...request.params};
    final dynamic body = request.body;
    final Map<String, dynamic> contextExtra = <String, dynamic>{
      ...request.options.extra
    };
    Map<String, dynamic> sessionAttributes = _sessionAttributes();
    AuthCoordinatorResult? coordinatorResult;

    if (!requirement.isRequired) {
      return _AuthPayloadContext(params: params, body: body);
    }

    final strategy = authRegistry.resolve(
        id: requirement.strategyId, requirement: requirement);
    if (strategy == null) {
      throw NetworkError(message: 'No auth strategy for requirement');
    }

    if (authCoordinator != null) {
      coordinatorResult = await authCoordinator!.prepare(
        requirement: requirement,
        request: request,
      );
      if (!coordinatorResult.isEmpty) {
        headers.addAll(coordinatorResult.additionalHeaders);
        if (coordinatorResult.metadata.isNotEmpty) {
          contextExtra['authCoordinatorMetadata'] = coordinatorResult.metadata;
        }
        if (coordinatorResult.sessionUpdate.isNotEmpty) {
          sessionAttributes = <String, dynamic>{
            ...sessionAttributes,
            ...coordinatorResult.sessionUpdate,
          };
        }
      }
    }

    final authContext = AuthContext(
      request: request,
      requirement: requirement,
      session: sessionAttributes,
      extra: contextExtra,
    );
    final payload = await strategy.build(authContext);

    headers.addAll(payload.headers);
    if (payload.cookies.isNotEmpty) {
      final cookie =
          payload.cookies.entries.map((e) => e.key + '=' + e.value).join('; ');
      headers['Cookie'] = cookie;
    }
    params.addAll(payload.query);

    return _AuthPayloadContext(params: params, body: body);
  }

  Map<String, dynamic> _sessionAttributes() {
    final state = loginManager.state;
    return <String, dynamic>{
      'clientKey': state.clientKey,
      'jwt': state.jwt,
      'sessionId': state.sessionId,
      ...state.attributes,
    };
  }

  dynamic _prepareBody(EndpointDescriptor descriptor,
      Map<String, String> headers, dynamic body) {
    if (body == null) {
      return null;
    }
    switch (descriptor.bodyType) {
      case RequestBodyType.json:
        headers.putIfAbsent('Content-Type', () => 'application/json');
        if (body is String) {
          return body;
        }
        return jsonEncode(body);
      case RequestBodyType.form:
        headers.putIfAbsent(
            'Content-Type', () => 'application/x-www-form-urlencoded');
        if (body is Map<String, dynamic>) {
          return body.entries
              .map((entry) =>
                  Uri.encodeQueryComponent(entry.key) +
                  '=' +
                  Uri.encodeQueryComponent(entry.value?.toString() ?? ''))
              .join('&');
        }
        return body;
      case RequestBodyType.multipart:
      case RequestBodyType.binary:
        return body;
    }
  }

  CachePolicy _resolveCachePolicy(NetworkRequest request) {
    final endpointPolicy = request.endpoint.cachePolicy;
    final groupPolicy = request.endpoint.group.defaultCachePolicy;

    final override = request.options.cachePolicy;
    if (override != null) {
      return override;
    }
    if (endpointPolicy != null) {
      return endpointPolicy;
    }
    if (groupPolicy != null) {
      return groupPolicy;
    }
    return defaultCachePolicy;
  }

  RetryPolicy _resolveRetryPolicy(NetworkRequest request) {
    final override = request.options.retryPolicy;
    if (override != null) {
      return override;
    }
    final endpointPolicy = request.endpoint.retryPolicy;
    if (endpointPolicy != null) {
      return endpointPolicy;
    }
    final groupPolicy = request.endpoint.group.defaultRetryPolicy;
    if (groupPolicy != null) {
      return groupPolicy;
    }
    return defaultRetryPolicy;
  }

  AuthRequirement _resolveAuthRequirement(NetworkRequest request) {
    final endpointRequirement = request.endpoint.authRequirement;
    final groupRequirement = request.endpoint.group.defaultAuth;
    AuthRequirement requirement =
        endpointRequirement ?? groupRequirement ?? const AuthRequirement.none();

    if (request.options.authStrategyId != null ||
        request.options.requiredClaims != null) {
      requirement = AuthRequirement(
        scope: requirement.scope,
        strategyId: request.options.authStrategyId ?? requirement.strategyId,
        requiredClaims:
            request.options.requiredClaims ?? requirement.requiredClaims,
      );
    }
    return requirement;
  }

  String _buildCacheKey(NetworkRequest request, CachePolicy policy) {
    if (policy.cacheKeyBuilder != null) {
      return policy.cacheKeyBuilder!(
        request.endpoint.id,
        request.params,
        request.body,
      );
    }

    final buffer = StringBuffer(request.endpoint.id);
    final sortedParams = request.params.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    for (final entry in sortedParams) {
      buffer.write('|' + entry.key + '=' + entry.value.toString());
    }
    if (request.body != null) {
      buffer.write('|body=' + jsonEncode(request.body));
    }
    return buffer.toString();
  }

  network_types.NetworkResponse<T> _fromCache<T>(
      NetworkRequest request, CacheEntry entry,
      {bool isStale = false}) {
    final typed = _castResponseData<T>(entry.data);
    return network_types.NetworkResponse<T>(
      data: typed,
      statusCode: entry.metadata?['statusCode'] ?? 200,
      headers: entry.metadata?['headers'],
      isFromCache: true,
      isStale: isStale,
      timestamp: entry.createdAt,
      latency: entry.latency,
      metadata: entry.metadata,
    );
  }

  T? _castResponseData<T>(dynamic data) {
    if (data == null) {
      return null;
    }
    if (data is T) {
      return data;
    }
    if (T == dynamic) {
      return data as T;
    }
    return data as T;
  }

  String _extractErrorMessage(dynamic parsed, HttpRawResponse raw) {
    if (parsed is Map<String, dynamic>) {
      if (parsed['message'] is String) {
        return parsed['message'] as String;
      }
      if (parsed['error'] is String) {
        return parsed['error'] as String;
      }
    }
    return 'HTTP ' + raw.statusCode.toString();
  }

  void _maybeUpdateLogin(EndpointDescriptor descriptor, dynamic parsed) {
    if (descriptor.group.securityLevel != EndpointSecurityLevel.login) {
      return;
    }
    if (parsed is! Map<String, dynamic>) {
      return;
    }
    final jwt = _findString(
        parsed, const ['token', 'jwt', 'access_token', 'accessToken']);
    final refreshToken =
        _findString(parsed, const ['refresh_token', 'refreshToken']);
    final sessionId =
        _findString(parsed, const ['session', 'sessionId', 'sid']);
    final clientKey =
        _findString(parsed, const ['clientKey', 'client_key', 'client']);
    final expiresIn = _findInt(parsed, const ['expires_in', 'expiresIn']);
    final claims = _findList(parsed, const ['permissions', 'claims']);

    loginManager.updateFromLogin(
      jwt: jwt,
      refreshToken: refreshToken,
      sessionId: sessionId,
      clientKey: clientKey,
      claims: claims?.toSet(),
      attributes: parsed,
      ttl: expiresIn != null ? Duration(seconds: expiresIn) : null,
    );
  }

  String? _findString(Map<String, dynamic> source, List<String> keys) {
    for (final key in keys) {
      final value = source[key];
      if (value is String && value.isNotEmpty) {
        return value;
      }
    }
    return null;
  }

  int? _findInt(Map<String, dynamic> source, List<String> keys) {
    for (final key in keys) {
      final value = source[key];
      if (value is int) {
        return value;
      }
      if (value is String) {
        final parsed = int.tryParse(value);
        if (parsed != null) {
          return parsed;
        }
      }
    }
    return null;
  }

  List<String>? _findList(Map<String, dynamic> source, List<String> keys) {
    for (final key in keys) {
      final value = source[key];
      if (value is List) {
        return value.whereType<String>().toList();
      }
    }
    return null;
  }
}

class _AuthPayloadContext {
  _AuthPayloadContext({required this.params, required this.body});

  final Map<String, dynamic> params;
  final dynamic body;
}
