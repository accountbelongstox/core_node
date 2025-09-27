class NetworkEnvironment {
  const NetworkEnvironment({
    required this.baseUrl,
    this.assetBaseUrl,
    this.webSocketBaseUrl,
    this.metadata = const <String, dynamic>{},
  });

  final String baseUrl;
  final String? assetBaseUrl;
  final String? webSocketBaseUrl;
  final Map<String, dynamic> metadata;

  Uri resolve(String path, {Map<String, dynamic>? query}) {
    final uri = Uri.parse(baseUrl + path);
    if (query == null || query.isEmpty) {
      return uri;
    }
    return uri.replace(queryParameters: {
      ...uri.queryParameters,
      ...query.map((key, value) => MapEntry(key, value?.toString() ?? '')),
    });
  }
}
