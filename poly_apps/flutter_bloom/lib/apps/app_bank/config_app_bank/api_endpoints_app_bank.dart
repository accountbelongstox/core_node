// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
