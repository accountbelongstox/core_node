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

import '../../../common/network/network_framework.dart';

class BankEndpointConfig extends EndpointConfig {
  BankEndpointConfig() : super(
    appName: 'bank',
    version: 'v1',
    basePath: '/api/bank',
    groups: _groups,
    endpoints: _endpoints,
  );

  // Fix: Remove const to allow non-const enum values in constructor
  static final Map<String, EndpointGroup> _groups = {
    'public': EndpointGroup(
      name: 'public',
      requestType: RequestType.public,
      enableCache: true,
      cacheDuration: Duration(minutes: 5),
      priority: RequestPriority.normal,
    ),
    
    'auth': EndpointGroup(
      name: 'auth',
      basePath: '/auth',
      requestType: RequestType.public,
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'authenticated': EndpointGroup(
      name: 'authenticated',
      requestType: RequestType.authenticated,
      authType: AuthType.jwt,
      enableCache: true,
      cacheDuration: Duration(minutes: 3),
      priority: RequestPriority.normal,
    ),
    
    'security': EndpointGroup(
      name: 'security',
      basePath: '/security',
      requestType: RequestType.authenticated,
      authType: AuthType.jwt,
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'app': EndpointGroup(
      name: 'app',
      basePath: '/app',
      requestType: RequestType.authenticated,
      authType: AuthType.jwt,
      enableCache: false,
      priority: RequestPriority.normal,
    ),
  };

  // Fix: Remove const from all EndpointDefinitions
  static final Map<String, EndpointDefinition> _endpoints = {
    // Authentication endpoints
    'login': EndpointDefinition(
      name: 'login',
      method: 'POST',
      path: '/login',
      groupName: 'auth',
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'register': EndpointDefinition(
      name: 'register',
      method: 'POST',
      path: '/register',
      groupName: 'auth',
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'logout': EndpointDefinition(
      name: 'logout',
      method: 'POST',
      path: '/logout',
      groupName: 'authenticated',
      enableCache: false,
      priority: RequestPriority.normal,
    ),
    
    'refreshToken': EndpointDefinition(
      name: 'refreshToken',
      method: 'POST',
      path: '/refresh',
      groupName: 'auth',
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'verifyToken': EndpointDefinition(
      name: 'verifyToken',
      method: 'POST',
      path: '/verify',
      groupName: 'authenticated',
      enableCache: false,
      priority: RequestPriority.normal,
    ),

    // App lifecycle endpoints
    'appOpen': EndpointDefinition(
      name: 'appOpen',
      method: 'POST',
      path: '/open',
      groupName: 'app',
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'appClose': EndpointDefinition(
      name: 'appClose',
      method: 'POST',
      path: '/close',
      groupName: 'app',
      enableCache: false,
      priority: RequestPriority.normal,
    ),
    
    'appHeartbeat': EndpointDefinition(
      name: 'appHeartbeat',
      method: 'POST',
      path: '/heartbeat',
      groupName: 'app',
      enableCache: false,
      priority: RequestPriority.low,
    ),

    // User management endpoints
    'userProfile': EndpointDefinition(
      name: 'userProfile',
      method: 'GET',
      path: '/user/profile',
      groupName: 'authenticated',
      enableCache: true,
      cacheDuration: Duration(minutes: 5),
      priority: RequestPriority.normal,
    ),
    
    'updateProfile': EndpointDefinition(
      name: 'updateProfile',
      method: 'PUT',
      path: '/user/profile/update',
      groupName: 'authenticated',
      enableCache: false,
      priority: RequestPriority.normal,
    ),
    
    'updateBalance': EndpointDefinition(
      name: 'updateBalance',
      method: 'PUT',
      path: '/user/balance/update',
      groupName: 'authenticated',
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'updateAddress': EndpointDefinition(
      name: 'updateAddress',
      method: 'PUT',
      path: '/user/address/update',
      groupName: 'authenticated',
      enableCache: false,
      priority: RequestPriority.normal,
    ),
    
    'registerWithCode': EndpointDefinition(
      name: 'registerWithCode',
      method: 'POST',
      path: '/user/register-code',
      groupName: 'authenticated',
      enableCache: false,
      priority: RequestPriority.normal,
    ),

    // Security endpoints
    'deviceRegister': EndpointDefinition(
      name: 'deviceRegister',
      method: 'POST',
      path: '/device/register',
      groupName: 'security',
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'deviceStatus': EndpointDefinition(
      name: 'deviceStatus',
      method: 'GET',
      path: '/device/status',
      groupName: 'security',
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'securityCheck': EndpointDefinition(
      name: 'securityCheck',
      method: 'POST',
      path: '/check',
      groupName: 'security',
      enableCache: false,
      priority: RequestPriority.critical,
    ),

    // Account endpoints
    'accountBalance': EndpointDefinition(
      name: 'accountBalance',
      method: 'GET',
      path: '/account/balance',
      groupName: 'authenticated',
      enableCache: true,
      cacheDuration: Duration(minutes: 2),
      priority: RequestPriority.normal,
    ),
    
    'accountHistory': EndpointDefinition(
      name: 'accountHistory',
      method: 'GET',
      path: '/account/history',
      groupName: 'authenticated',
      enableCache: true,
      cacheDuration: Duration(minutes: 5),
      priority: RequestPriority.normal,
    ),
    
    'accountDetails': EndpointDefinition(
      name: 'accountDetails',
      method: 'GET',
      path: '/account/details',
      groupName: 'authenticated',
      enableCache: true,
      cacheDuration: Duration(minutes: 10),
      priority: RequestPriority.normal,
    ),

    // Transaction endpoints
    'transactions': EndpointDefinition(
      name: 'transactions',
      method: 'GET',
      path: '/transactions',
      groupName: 'authenticated',
      enableCache: true,
      cacheDuration: Duration(minutes: 3),
      priority: RequestPriority.normal,
    ),
    
    'transfer': EndpointDefinition(
      name: 'transfer',
      method: 'POST',
      path: '/transactions/transfer',
      groupName: 'authenticated',
      enableCache: false,
      priority: RequestPriority.high,
    ),
    
    'payment': EndpointDefinition(
      name: 'payment',
      method: 'POST',
      path: '/transactions/payment',
      groupName: 'authenticated',
      enableCache: false,
      priority: RequestPriority.high,
    ),
  };
}
