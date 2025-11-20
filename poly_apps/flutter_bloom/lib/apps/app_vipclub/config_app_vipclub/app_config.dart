enum Environment {
  development,
  production,
}

class VipClubAppConfig {
  static const String appName = 'VIP Club';
  static const String appVersion = '1.0.0';
  static const String appBuildNumber = '1';

  // Environment configuration
  static const Environment currentEnvironment = Environment.development;

  // API Base URLs
  static const String _apiBaseUrlDev = 'http://127.0.0.1:8000/api/vipclubv1';
  static const String _apiBaseUrlProd = 'https://api.vipclub.si.12gm.com/api/vipclubv1';

  static String get apiBaseUrl {
    switch (currentEnvironment) {
      case Environment.development:
        return _apiBaseUrlDev;
      case Environment.production:
        return _apiBaseUrlProd;
    }
  }

  static const String apiVersion = 'v1';

  // Full API endpoint URL
  static String get apiEndpoint => '$apiBaseUrl/$apiVersion';

  static const int requestTimeout = 30000;
  static const int maxRetries = 3;

  static const bool enableLogging = true;
  static const bool enableAnalytics = true;

  static const int paginationPageSize = 20;
  static const int maxUploadFileSize = 10485760;

  static const String defaultLanguage = 'en';
  static const List<String> supportedLanguages = ['en', 'zh'];

  static const int vipPointsPerDollar = 10;
  static const int goldCardMinPoints = 10000;
  static const int platinumCardMinPoints = 50000;
  static const int diamondCardMinPoints = 100000;
}
