/// API Endpoints Configuration for Bank App
/// 
/// Defines all available API endpoints with priority ordering
library;

import 'package:qyflutter/common/network/core/api_endpoint_manager.dart';

/// Bank App API Endpoints
/// 
/// Priority order (lower number = higher priority):
/// 1. Local development server (192.168.50.3:9000)
/// 2. Production server 1 (api.si.gm15.com)
/// 3. Production server 2 (api.si.12gm.com)
class ApiEndpointsAppBank {
  static const List<ApiEndpoint> endpoints = [
    ApiEndpoint(
      id: 'local_lan',
      url: '192.168.50.3',
      protocol: 'http',
      port: 9000,
      priority: 1,
      isLocal: true,
      description: 'Local LAN Development Server',
    ),
    ApiEndpoint(
      id: 'production_gm15',
      url: 'api.si.gm15.com',
      protocol: 'https',
      priority: 2,
      isLocal: false,
      description: 'Production Server GM15',
    ),
    ApiEndpoint(
      id: 'production_12gm',
      url: 'api.si.12gm.com',
      protocol: 'https',
      priority: 3,
      isLocal: false,
      description: 'Production Server 12GM',
    ),
  ];

  /// Initialize endpoint manager for Bank app
  static void configure() {
    final manager = ApiEndpointManager();
    manager.configureEndpoints(endpoints);
  }
}
