# network_v2

A modular networking framework for Flutter sub-apps. Each sub-app only supplies endpoint metadata while the core handles authentication, caching, retries, queues, parsing, and global loading states.

## Highlights
- Endpoint groups for public, login, authenticated, permissioned, and privileged APIs
- Built-in auth strategies: client header keys, JWT, session cookies, composite strategies
- Configurable caching with TTL, stale fallback, and custom cache keys
- Automatic retries with exponential backoff and status-code filters
- Priority request queue for large uploads or unstable networks
- Global loading stream for driving request spinners in the host shell
- Login manager caches session data and exposes state to auth strategies
- Automatic response parsing with schema registry and validation fallback

## Quick Start
```dart
final environment = NetworkEnvironment(baseUrl: 'https://api.example.com');
final manager = NetworkManager(environment: environment);

manager.authRegistry
  ..register(HeaderKeyAuthStrategy(
    id: 'client',
    headerName: 'X-Client-Key',
    clientKeyProvider: () async => manager.loginManager.state.clientKey,
  ))
  ..register(JwtAuthStrategy(
    id: 'jwt',
    tokenProvider: () async => manager.loginManager.state.jwt,
  ));

final catalog = EndpointCatalog(manager);
final publicEndpoints = publicGroup(id: 'public');
final secureEndpoints = authenticatedGroup(id: 'secure', strategyId: 'jwt');

catalog
  ..define(
    id: 'health',
    group: publicEndpoints,
    method: HttpMethod.get,
    path: '/health',
    cachePolicy: const CachePolicy(ttl: Duration(minutes: 1)),
  )
  ..define(
    id: 'profile',
    group: secureEndpoints,
    method: HttpMethod.get,
    path: '/users/{id}',
  );

final response = await manager.requestById<Map<String, dynamic>>(
  'profile',
  params: {
    'path': {'id': '42'},
  },
);
```

## Modules
- `NetworkManager`: orchestrates caching, retries, auth, parsing, and loading state
- `EndpointCatalog` & presets: declare endpoints with minimal boilerplate
- `AuthRegistry`: register and resolve auth strategies per requirement
- `CacheStore`: swap memory cache with a persistent store if needed
- `RequestQueue`: bounded concurrency with priorities and completion callbacks
- `LoadingController`: broadcast active request count and queue depth
- `SchemaRegistry`: plug in custom parsers or schemas; falls back to auto parser

## Response Handling
1. Try endpoint-specific parser
2. Fallback to registry parser
3. Fallback to `AutoResponseParser`
4. If a `ResponseValidator` fails, auto retry parsing before raising an error

## Caching & Resilience
- `CachePolicy` controls TTL, stale usage, and cache key binding
- Request options support `useCacheOnly` and `forceRefresh`
- `RetryPolicy` enables network retries and exponential backoff
- When allowed, stale cache is returned on network failures

## Authentication & Permissions
- Mark login endpoints with `loginGroup`; tokens are captured automatically
- `AuthRequirement` expresses client/user/permission/privileged scopes
- Override per-request auth strategy or required claims via `RequestOptions`

## Queues & Loading UX
- Queue priority: low, normal, high
- `LoadingController.stream` drives global progress indicators

## Migration Tips
1. Map existing endpoints into the new group presets
2. Port authentication logic into distinct `AuthStrategy` implementations
3. Replace direct HTTP calls with `NetworkManager.requestById`
4. Incrementally migrate features while leveraging automatic parsing and caching

See `example_usage.dart` for a runnable walkthrough.
