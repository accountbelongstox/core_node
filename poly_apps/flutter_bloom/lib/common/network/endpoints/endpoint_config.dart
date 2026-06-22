import '../core/network_config.dart';
// REFACTOR: Renamed network_models.dart to endpoint_network_models.dart
import '../core/endpoint_network_models.dart';
// REFACTOR: Import all required types from network_types.dart
import '../core/network_types.dart' show CancelToken, RequestType, AuthType, CacheStrategy, RequestPriority;
import 'package:qyflutter/common/constants/app_constants.dart';

/// Endpoint configuration for sub-applications
class EndpointConfig {
  final String appName;
  final String version;
  final String? basePath;
  final Map<String, EndpointGroup> groups;
  final Map<String, EndpointDefinition> endpoints;

  const EndpointConfig({
    required this.appName,
    this.version = 'v1',
    this.basePath,
    this.groups = const {},
    this.endpoints = const {},
  });

  /// Get endpoint by name
  EndpointDefinition? getEndpoint(String name) {
    return endpoints[name];
  }

  /// Get group by name
  EndpointGroup? getGroup(String name) {
    return groups[name];
  }

  /// Get all endpoints for a group
  List<EndpointDefinition> getEndpointsForGroup(String groupName) {
    return endpoints.values
        .where((endpoint) => endpoint.groupName == groupName)
        .toList();
  }

  /// Validate configuration
  List<String> validate() {
    final errors = <String>[];

    // Check for duplicate endpoint names
    final endpointNames = endpoints.keys.toSet();
    if (endpointNames.length != endpoints.length) {
      errors.add('Duplicate endpoint names found');
    }

    // Check for missing groups
    for (final endpoint in endpoints.values) {
      if (endpoint.groupName != null && !groups.containsKey(endpoint.groupName)) {
        errors.add('Endpoint ${endpoint.name} references unknown group ${endpoint.groupName}');
      }
    }

    // Validate individual endpoints
    for (final endpoint in endpoints.values) {
      errors.addAll(endpoint.validate());
    }

    return errors;
  }

  EndpointConfig copyWith({
    String? appName,
    String? version,
    String? basePath,
    Map<String, EndpointGroup>? groups,
    Map<String, EndpointDefinition>? endpoints,
  }) {
    return EndpointConfig(
      appName: appName ?? this.appName,
      version: version ?? this.version,
      basePath: basePath ?? this.basePath,
      groups: groups ?? this.groups,
      endpoints: endpoints ?? this.endpoints,
    );
  }
}

/// Individual endpoint definition
class EndpointDefinition {
  final String name;
  final String method;
  final String path;
  final String? groupName;
  final RequestType? requestType;
  final AuthType? authType;
  final Map<String, String>? headers;
  final Duration? timeout;
  final bool? enableCache;
  final Duration? cacheDuration;
  final CacheStrategy? cacheStrategy;
  final int? maxRetries;
  final RequestPriority? priority;
  final Type? requestModel;
  final Type? responseModel;
  final Map<String, ParameterDefinition>? parameters;
  final Map<String, dynamic>? metadata;

  const EndpointDefinition({
    required this.name,
    required this.method,
    required this.path,
    this.groupName,
    this.requestType,
    this.authType,
    this.headers,
    this.timeout,
    this.enableCache,
    this.cacheDuration,
    this.cacheStrategy,
    this.maxRetries,
    this.priority,
    this.requestModel,
    this.responseModel,
    this.parameters,
    this.metadata,
  });

  /// Get effective endpoint group
  EndpointGroup? getEffectiveGroup(EndpointConfig config) {
    if (groupName == null) return null;
    return config.getGroup(groupName!);
  }

  /// Get effective request type
  RequestType getEffectiveRequestType(EndpointConfig config) {
    if (requestType != null) return requestType!;
    
    final group = getEffectiveGroup(config);
    if (group?.requestType != null) return group!.requestType;
    
    return RequestType.public;
  }

  /// Get effective auth type
  AuthType? getEffectiveAuthType(EndpointConfig config) {
    if (authType != null) return authType;
    
    final group = getEffectiveGroup(config);
    return group?.authType;
  }

  /// Get effective headers
  Map<String, String> getEffectiveHeaders(EndpointConfig config) {
    final effectiveHeaders = <String, String>{};
    
    // Add group headers
    final group = getEffectiveGroup(config);
    if (group?.headers != null) {
      effectiveHeaders.addAll(group!.headers!);
    }
    
    // Add endpoint headers (override group headers)
    if (headers != null) {
      effectiveHeaders.addAll(headers!);
    }
    
    return effectiveHeaders;
  }

  /// Get effective timeout
  Duration? getEffectiveTimeout(EndpointConfig config) {
    if (timeout != null) return timeout;
    
    final group = getEffectiveGroup(config);
    return group?.timeout;
  }

  /// Get effective cache settings
  bool getEffectiveEnableCache(EndpointConfig config) {
    if (enableCache != null) return enableCache!;
    
    final group = getEffectiveGroup(config);
    if (group?.enableCache != null) return group!.enableCache!;
    
    return NetworkConfig.instance.enableCache;
  }

  /// Get effective cache duration
  Duration getEffectiveCacheDuration(EndpointConfig config) {
    if (cacheDuration != null) return cacheDuration!;
    
    final group = getEffectiveGroup(config);
    if (group?.cacheDuration != null) return group!.cacheDuration!;
    
    return NetworkConfig.instance.defaultCacheDuration;
  }

  /// Get effective cache strategy
  CacheStrategy getEffectiveCacheStrategy(EndpointConfig config) {
    if (cacheStrategy != null) return cacheStrategy!;
    
    final group = getEffectiveGroup(config);
    if (group?.cacheStrategy != null) return group!.cacheStrategy!;
    
    return CacheStrategy.cacheFirst;
  }

  /// Get effective max retries
  int getEffectiveMaxRetries(EndpointConfig config) {
    if (maxRetries != null) return maxRetries!;
    
    final group = getEffectiveGroup(config);
    if (group?.maxRetries != null) return group!.maxRetries!;
    
    return NetworkConfig.instance.maxRetries;
  }

  /// Get effective priority
  RequestPriority getEffectivePriority(EndpointConfig config) {
    if (priority != null) return priority!;
    
    final group = getEffectiveGroup(config);
    if (group?.priority != null) return group!.priority;
    
    return RequestPriority.normal;
  }

  /// Build full path
  String buildFullPath(EndpointConfig config, {Map<String, dynamic>? pathParams}) {
    final group = getEffectiveGroup(config);
    final basePath = config.basePath ?? '';
    final groupPath = group?.basePath ?? '';
    
    String fullPath = '$basePath$groupPath$path';
    
    // Replace path parameters
    if (pathParams != null) {
      for (final entry in pathParams.entries) {
        fullPath = fullPath.replaceAll('{${entry.key}}', entry.value.toString());
      }
    }
    
    return fullPath;
  }

  /// Create network request from this endpoint
  NetworkRequest createRequest({
    Map<String, dynamic>? queryParameters,
    dynamic data,
    Map<String, String>? additionalHeaders,
    Map<String, dynamic>? pathParams,
    EndpointConfig? config,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    Function(int received, int total)? onReceiveProgress,
    CancelToken? cancelToken,
  }) {
    final effectiveConfig = config ?? _getDefaultConfig();
    final group = getEffectiveGroup(effectiveConfig);
    
    final headers = <String, String>{};
    headers.addAll(getEffectiveHeaders(effectiveConfig));
    if (additionalHeaders != null) {
      headers.addAll(additionalHeaders);
    }

    return NetworkRequest(
      id: requestId,
      method: method,
      path: buildFullPath(effectiveConfig, pathParams: pathParams),
      queryParameters: queryParameters,
      data: data,
      headers: headers.isNotEmpty ? headers : null,
      endpointGroup: group,
      timeout: getEffectiveTimeout(effectiveConfig),
      enableCache: getEffectiveEnableCache(effectiveConfig),
      cacheDuration: getEffectiveCacheDuration(effectiveConfig),
      cacheStrategy: getEffectiveCacheStrategy(effectiveConfig),
      maxRetries: getEffectiveMaxRetries(effectiveConfig),
      priority: getEffectivePriority(effectiveConfig),
      metadata: metadata,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
      cancelToken: cancelToken,
    );
  }

  /// Validate endpoint definition
  List<String> validate() {
    final errors = <String>[];

    if (name.isEmpty) {
      errors.add('Endpoint name cannot be empty');
    }

    if (method.isEmpty) {
      errors.add('Endpoint method cannot be empty');
    }

    if (path.isEmpty) {
      errors.add('Endpoint path cannot be empty');
    }

    final validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    if (!validMethods.contains(method.toUpperCase())) {
      errors.add('Invalid HTTP method: $method');
    }

    if (!path.startsWith('/')) {
      errors.add('Endpoint path must start with /');
    }

    // Validate parameters
    if (parameters != null) {
      for (final param in parameters!.values) {
        errors.addAll(param.validate());
      }
    }

    return errors;
  }

  EndpointConfig _getDefaultConfig() {
    return const EndpointConfig(appName: 'default');
  }

  EndpointDefinition copyWith({
    String? name,
    String? method,
    String? path,
    String? groupName,
    RequestType? requestType,
    AuthType? authType,
    Map<String, String>? headers,
    Duration? timeout,
    bool? enableCache,
    Duration? cacheDuration,
    CacheStrategy? cacheStrategy,
    int? maxRetries,
    RequestPriority? priority,
    Type? requestModel,
    Type? responseModel,
    Map<String, ParameterDefinition>? parameters,
    Map<String, dynamic>? metadata,
  }) {
    return EndpointDefinition(
      name: name ?? this.name,
      method: method ?? this.method,
      path: path ?? this.path,
      groupName: groupName ?? this.groupName,
      requestType: requestType ?? this.requestType,
      authType: authType ?? this.authType,
      headers: headers ?? this.headers,
      timeout: timeout ?? this.timeout,
      enableCache: enableCache ?? this.enableCache,
      cacheDuration: cacheDuration ?? this.cacheDuration,
      cacheStrategy: cacheStrategy ?? this.cacheStrategy,
      maxRetries: maxRetries ?? this.maxRetries,
      priority: priority ?? this.priority,
      requestModel: requestModel ?? this.requestModel,
      responseModel: responseModel ?? this.responseModel,
      parameters: parameters ?? this.parameters,
      metadata: metadata ?? this.metadata,
    );
  }
}

/// Parameter definition for endpoints
class ParameterDefinition {
  final String name;
  final ParameterType type;
  final ParameterLocation location;
  final bool required;
  final dynamic defaultValue;
  final String? description;
  final List<dynamic>? allowedValues;
  final String? pattern;
  final dynamic minimum;
  final dynamic maximum;

  const ParameterDefinition({
    required this.name,
    required this.type,
    required this.location,
    this.required = false,
    this.defaultValue,
    this.description,
    this.allowedValues,
    this.pattern,
    this.minimum,
    this.maximum,
  });

  /// Validate parameter definition
  List<String> validate() {
    final errors = <String>[];

    if (name.isEmpty) {
      errors.add('Parameter name cannot be empty');
    }

    if (allowedValues != null && allowedValues!.isEmpty) {
      errors.add('Allowed values cannot be empty if specified');
    }

    return errors;
  }
}

/// Parameter types
enum ParameterType {
  string,
  integer,
  number,
  boolean,
  array,
  object,
}

/// Parameter locations
enum ParameterLocation {
  query,
  path,
  header,
  body,
}

/// Laravel API Endpoints Configuration
class LaravelEndpoints {
  static const String laravelApiBase = '${AppConstants.appQyUserBaseUrl}/api';
  static const String laravelPrefix = '$laravelApiBase/dict/v1';

  /// Laravel Guest Endpoints (Public APIs)
  static final EndpointConfig guestEndpoints = EndpointConfig(
    appName: 'laravel_guest',
    version: 'v1',
    basePath: laravelApiBase,
    groups: {
      'auth': EndpointGroup(
        name: 'auth',
        basePath: '',
        requestType: RequestType.public,
        timeout: const Duration(seconds: 30),
        maxRetries: 3,
      ),
      'system': EndpointGroup(
        name: 'system',
        basePath: '',
        requestType: RequestType.public,
        timeout: const Duration(seconds: 10),
        maxRetries: 1,
      ),
    },
    endpoints: {
      'register': EndpointDefinition(
        name: 'register',
        method: 'POST',
        path: '/register',
        groupName: 'auth',
        requestType: RequestType.public,
        priority: RequestPriority.high,
        enableCache: false,
        metadata: {'description': 'User registration'},
      ),
      'login': EndpointDefinition(
        name: 'login',
        method: 'POST',
        path: '/login',
        groupName: 'auth',
        requestType: RequestType.public,
        priority: RequestPriority.high,
        enableCache: false,
        metadata: {'description': 'User login'},
      ),
      'forgotPassword': EndpointDefinition(
        name: 'forgotPassword',
        method: 'POST',
        path: '/forgot-password',
        groupName: 'auth',
        requestType: RequestType.public,
        enableCache: false,
        metadata: {'description': 'Send password reset email'},
      ),
      'resetPassword': EndpointDefinition(
        name: 'resetPassword',
        method: 'POST',
        path: '/reset-password',
        groupName: 'auth',
        requestType: RequestType.public,
        enableCache: false,
        metadata: {'description': 'Reset user password'},
      ),
      'verifyEmail': EndpointDefinition(
        name: 'verifyEmail',
        method: 'GET',
        path: '/verify-email/{id}/{hash}',
        groupName: 'auth',
        requestType: RequestType.public,
        enableCache: false,
        parameters: {
          'id': ParameterDefinition(
            name: 'id',
            type: ParameterType.string,
            location: ParameterLocation.path,
            required: true,
          ),
          'hash': ParameterDefinition(
            name: 'hash',
            type: ParameterType.string,
            location: ParameterLocation.path,
            required: true,
          ),
        },
        metadata: {'description': 'Verify user email address'},
      ),
      'emailVerificationNotification': EndpointDefinition(
        name: 'emailVerificationNotification',
        method: 'POST',
        path: '/email/verification-notification',
        groupName: 'auth',
        requestType: RequestType.public,
        enableCache: false,
        metadata: {'description': 'Resend email verification'},
      ),
      'getSystemStatus': EndpointDefinition(
        name: 'getSystemStatus',
        method: 'GET',
        path: '/get_system_status',
        groupName: 'system',
        requestType: RequestType.public,
        enableCache: true,
        cacheDuration: Duration(minutes: 5),
        metadata: {'description': 'Get system status information'},
      ),
    },
  );

  /// Laravel Authenticated Endpoints (Requires Authentication)
  static final EndpointConfig authEndpoints = EndpointConfig(
    appName: 'laravel_auth',
    version: 'v1',
    basePath: laravelApiBase,
    groups: {
      'auth': EndpointGroup(
        name: 'auth',
        basePath: '',
        requestType: RequestType.authenticated,
        // FIXED: AuthType.bearer doesn't exist in enum, changed to AuthType.jwt
        // Bearer token authentication is implemented via JWT
        authType: AuthType.jwt,
        timeout: const Duration(seconds: 30),
        maxRetries: 2,
      ),
      'dictionary': EndpointGroup(
        name: 'dictionary',
        basePath: '/dict/v1',
        requestType: RequestType.authenticated,
        // FIXED: AuthType.bearer doesn't exist in enum, changed to AuthType.jwt
        authType: AuthType.jwt,
        timeout: const Duration(seconds: 15),
        enableCache: true,
        cacheDuration: Duration(minutes: 10),
        maxRetries: 3,
      ),
    },
    endpoints: {
      'logout': EndpointDefinition(
        name: 'logout',
        method: 'POST',
        path: '/logout',
        groupName: 'auth',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'User logout'},
      ),
      'user': EndpointDefinition(
        name: 'user',
        method: 'GET',
        path: '/user',
        groupName: 'auth',
        requestType: RequestType.authenticated,
        enableCache: true,
        cacheDuration: Duration(minutes: 5),
        metadata: {'description': 'Get current user information'},
      ),

      // Dictionary API Endpoints
      'createGroup': EndpointDefinition(
        name: 'createGroup',
        method: 'POST',
        path: '/create_group',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Create a new word group'},
      ),
      'queryAllGroups': EndpointDefinition(
        name: 'queryAllGroups',
        method: 'GET',
        path: '/query_all_groups',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Get all word groups'},
      ),
      'queryGroupByName': EndpointDefinition(
        name: 'queryGroupByName',
        method: 'GET',
        path: '/query_group_by_name',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Query group by name'},
      ),
      'queryGroupByGid': EndpointDefinition(
        name: 'queryGroupByGid',
        method: 'GET',
        path: '/query_group_by_gid',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Query group by GID'},
      ),
      'queryGwords': EndpointDefinition(
        name: 'queryGwords',
        method: 'GET',
        path: '/query_gwords',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Query group words'},
      ),
      'queryGcontent': EndpointDefinition(
        name: 'queryGcontent',
        method: 'GET',
        path: '/query_gcontent',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Query group content'},
      ),
      'queryGFrequency': EndpointDefinition(
        name: 'queryGFrequency',
        method: 'GET',
        path: '/query_gfrequency',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Query group frequency'},
      ),
      'deleteGroupByName': EndpointDefinition(
        name: 'deleteGroupByName',
        method: 'DELETE',
        path: '/delete_group_by_name',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Delete group by name'},
      ),
      'deleteGroupByGid': EndpointDefinition(
        name: 'deleteGroupByGid',
        method: 'DELETE',
        path: '/delete_group_by_gid',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Delete group by GID'},
      ),
      'createPersonalDictionary': EndpointDefinition(
        name: 'createPersonalDictionary',
        method: 'POST',
        path: '/create_personal_dictionary',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Create personal dictionary entry'},
      ),
      'queryPersonalDictionary': EndpointDefinition(
        name: 'queryPersonalDictionary',
        method: 'GET',
        path: '/query_personal_dictionary',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Query personal dictionary'},
      ),
      'queryPersonalDictionaryByWords': EndpointDefinition(
        name: 'queryPersonalDictionaryByWords',
        method: 'GET',
        path: '/query_personal_dictionary_by_words',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Query personal dictionary by words'},
      ),
      'deletePersonalDictionaryByID': EndpointDefinition(
        name: 'deletePersonalDictionaryByID',
        method: 'DELETE',
        path: '/delete_personal_dictionary_by_id',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Delete personal dictionary by ID'},
      ),
      'deletePersonalAllDictionary': EndpointDefinition(
        name: 'deletePersonalAllDictionary',
        method: 'DELETE',
        path: '/delete_personal_all_dictionary',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Delete all personal dictionary entries'},
      ),
      'queryWords': EndpointDefinition(
        name: 'queryWords',
        method: 'GET',
        path: '/query_words',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Query words'},
      ),
      'upLearned': EndpointDefinition(
        name: 'upLearned',
        method: 'PUT',
        path: '/up_learned',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Update learned status'},
      ),
      'upRead': EndpointDefinition(
        name: 'upRead',
        method: 'PUT',
        path: '/up_read',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Update read status'},
      ),
      'upWeight': EndpointDefinition(
        name: 'upWeight',
        method: 'PUT',
        path: '/up_weight',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Update word weight'},
      ),
      'upReviewed': EndpointDefinition(
        name: 'upReviewed',
        method: 'PUT',
        path: '/up_reviewed',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Update reviewed status'},
      ),
      'getAllGroupByManager': EndpointDefinition(
        name: 'getAllGroupByManager',
        method: 'GET',
        path: '/get_all_groups_by_manager',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        metadata: {'description': 'Get all groups by manager'},
      ),
      'createGroupAndFetchList': EndpointDefinition(
        name: 'createGroupAndFetchList',
        method: 'POST',
        path: '/create_group_and_fetch_list',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: false,
        metadata: {'description': 'Create group and fetch list'},
      ),
      'getGvars': EndpointDefinition(
        name: 'getGvars',
        method: 'GET',
        path: '/get_gvars',
        groupName: 'dictionary',
        requestType: RequestType.authenticated,
        enableCache: true,
        cacheDuration: Duration(minutes: 15),
        metadata: {'description': 'Get group variables'},
      ),
    },
  );

  /// Get all Laravel endpoints as a unified configuration
  static EndpointConfig getAllEndpoints() {
    final allEndpoints = <String, EndpointDefinition>{};
    final allGroups = <String, EndpointGroup>{};

    // Merge guest endpoints
    allGroups.addAll(guestEndpoints.groups);
    allEndpoints.addAll(guestEndpoints.endpoints);

    // Merge auth endpoints (with prefixes to avoid conflicts)
    for (final entry in authEndpoints.groups.entries) {
      allGroups['auth_${entry.key}'] = entry.value.copyWith(name: 'auth_${entry.key}');
    }
    for (final entry in authEndpoints.endpoints.entries) {
      final endpoint = entry.value;
      allEndpoints['auth_${entry.key}'] = endpoint.copyWith(
        name: 'auth_${entry.key}',
        groupName: endpoint.groupName != null ? 'auth_${endpoint.groupName}' : null,
      );
    }

    return EndpointConfig(
      appName: 'laravel_unified',
      version: 'v1',
      basePath: laravelApiBase,
      groups: allGroups,
      endpoints: allEndpoints,
    );
  }
}

/// Endpoint Group Extensions
extension EndpointGroupExtensions on EndpointGroup {
  EndpointGroup copyWith({
    String? name,
    String? basePath,
    RequestType? requestType,
    AuthType? authType,
    Map<String, String>? headers,
    Duration? timeout,
    bool? enableCache,
    Duration? cacheDuration,
    CacheStrategy? cacheStrategy,
    int? maxRetries,
    RequestPriority? priority,
    Map<String, dynamic>? metadata,
  }) {
    return EndpointGroup(
      name: name ?? this.name,
      basePath: basePath ?? this.basePath,
      requestType: requestType ?? this.requestType,
      authType: authType ?? this.authType,
      headers: headers ?? this.headers,
      timeout: timeout ?? this.timeout,
      enableCache: enableCache ?? this.enableCache,
      cacheDuration: cacheDuration ?? this.cacheDuration,
      cacheStrategy: cacheStrategy ?? this.cacheStrategy,
      maxRetries: maxRetries ?? this.maxRetries,
      priority: priority ?? this.priority,
      metadata: metadata ?? this.metadata,
    );
  }
}
