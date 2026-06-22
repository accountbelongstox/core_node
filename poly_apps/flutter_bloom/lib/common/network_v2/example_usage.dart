import 'package:qyflutter/common/network_v2/network_v2.dart';

Future<void> example() async {
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
  final loginEndpoints = loginGroup(id: 'login');
  final protectedEndpoints =
      authenticatedGroup(id: 'protected', strategyId: 'jwt');

  catalog
    ..define(
      id: 'healthcheck',
      group: publicEndpoints,
      method: HttpMethod.get,
      path: '/health',
      cachePolicy: const CachePolicy(ttl: Duration(minutes: 1)),
    )
    ..define(
      id: 'login',
      group: loginEndpoints,
      method: HttpMethod.post,
      path: '/auth/login',
      bodyType: RequestBodyType.json,
    )
    ..define(
      id: 'profile',
      group: protectedEndpoints,
      method: HttpMethod.get,
      path: '/users/{id}',
    );

  manager.loadingController.stream.listen((state) {
    if (state.isLoading) {
      // show spinner
    } else {
      // hide spinner
    }
  });

  final loginResponse = await manager.requestById<dynamic>(
    'login',
    body: {
      'username': 'demo',
      'password': 'secret',
    },
  );

  if (loginResponse.isSuccess) {
    final profile = await manager.requestById<Map<String, dynamic>>(
      'profile',
      params: {
        'path': {'id': '42'},
      },
      options: const RequestOptions(
        cachePolicy: CachePolicy(ttl: Duration(minutes: 5)),
      ),
    );
    print(profile.data);
  }
}
