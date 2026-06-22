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

import 'package:flutter/material.dart';
import '../../../common/network/network_framework.dart';
import 'auth_api_app_example_service.dart';
import 'user_api_app_example_service.dart';
import 'product_api_app_example_service.dart';

/// Service manager that coordinates all API services with the new network framework
/// This is the recommended way to use the API services in your app
class AppExampleServiceManager {
  final BuildContext context;
  late final AuthApiAppExampleService _authService;
  late final UserApiAppExampleService _userService;
  late final ProductApiAppExampleService _productService;

  AppExampleServiceManager({required this.context}) {
    // Create services with the new network framework
    _authService = AuthApiAppExampleService(context: context);
    _userService = UserApiAppExampleService(context);
    _productService = ProductApiAppExampleService(context);
  }

  
  AuthApiAppExampleService get auth => _authService;
  UserApiAppExampleService get user => _userService;
  ProductApiAppExampleService get product => _productService;

  /// Check if user is authenticated across all services
  bool get isAuthenticated => _authService.isLoggedIn;
  
  /// Get current user info
  Map<String, dynamic>? get currentUser => _authService.getQyUserInfo();
  
  /// Get username
  String? get username => _authService.getUsername();
  
  /// Get user email
  String? get userEmail => _authService.getUserEmail();
  
  /// Get user display name
  String? get userDisplayName => _authService.getUsername();

  /// Login user
  Future<NetworkResponse<Map<String, dynamic>>> login({
    required String username,
    required String password,
    bool remember = false,
  }) async {
    return await _authService.login(
      username: username,
      password: password,
      remember: remember,
    );
  }
  
  /// Register user
  Future<NetworkResponse<Map<String, dynamic>>> register({
    required String email,
    required String password,
    required String username,
    String? firstName,
    String? lastName,
  }) async {
    return await _authService.register(
      email: email,
      password: password,
      username: username,
      firstName: firstName,
      lastName: lastName,
    );
  }
  
  /// Logout user
  Future<NetworkResponse<Map<String, dynamic>>> logout() async {
    return await _authService.logout();
  }

  
  /// Get overall service status
  Map<String, dynamic> getServiceStatus() {
    return {
      'manager': 'AppExampleServiceManager',
      'auth_status': isAuthenticated,
      'services': {
        'auth': _authService.getServiceStatus(),
        'user': _userService.getServiceStatus(),
        'product': _productService.getServiceStatus(),
      },
    };
  }
  
  /// Clear all caches
  void clearAllCaches() {
    // Services handle their own cache management
  }
  
  /// Dispose all resources
  void dispose() {
    _authService.dispose();
    _userService.dispose();
    _productService.dispose();
  }
}

/// Example widget showing how to use the service manager
class AppExampleUsageWidget extends StatefulWidget {
  const AppExampleUsageWidget({super.key});

  @override
  _AppExampleUsageWidgetState createState() => _AppExampleUsageWidgetState();
}

class _AppExampleUsageWidgetState extends State<AppExampleUsageWidget> {
  late AppExampleServiceManager serviceManager;
  bool isLoading = false;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    serviceManager = AppExampleServiceManager(context: context);
  }

  @override
  void dispose() {
    serviceManager.dispose();
    super.dispose();
  }

  Future<void> _performLogin() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final result = await serviceManager.login(
        username: 'test@example.com',
        password: 'password123',
      );

      if (result.isSuccess) {
        // Login successful, now we can use all services
        final userProfile = await serviceManager.user.getUserProfile();
        final contentList = await serviceManager.product.getContentList();
        
        print('User profile: $userProfile');
        print('Content list: ${contentList.length} items');
      } else {
        setState(() {
          errorMessage = result.message ?? 'Login failed';
        });
      }
    } catch (e) {
      setState(() {
        errorMessage = e.toString();
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('App Example Service Manager'),
      ),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Authentication Status: ${serviceManager.isAuthenticated ? "Logged In" : "Not Logged In"}',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            
            if (serviceManager.isAuthenticated) ...[
              Text('Username: ${serviceManager.username ?? "Unknown"}'),
              Text('Email: ${serviceManager.userEmail ?? "Unknown"}'),
              Text('Display Name: ${serviceManager.userDisplayName ?? "Unknown"}'),
              SizedBox(height: 16),
              
              ElevatedButton(
                onPressed: () async {
                  await serviceManager.logout();
                  setState(() {});
                },
                child: Text('Logout'),
              ),
            ] else ...[
              ElevatedButton(
                onPressed: isLoading ? null : _performLogin,
                child: isLoading 
                    ? CircularProgressIndicator()
                    : Text('Login'),
              ),
            ],
            
            if (errorMessage != null) ...[
              SizedBox(height: 16),
              Text(
                'Error: $errorMessage',
                style: TextStyle(color: Colors.red),
              ),
            ],
            
            SizedBox(height: 32),
            Text(
              'Service Status:',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Expanded(
              child: SingleChildScrollView(
                child: Text(
                  serviceManager.getServiceStatus().toString(),
                  style: TextStyle(fontFamily: 'monospace', fontSize: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Usage examples for different scenarios
class AppExampleUsageExamples {
  
  /// Example 1: Basic usage with service manager
  static void basicUsage(BuildContext context) async {
    final serviceManager = AppExampleServiceManager(context: context);
    
    // Login
    final loginResult = await serviceManager.login(
      username: 'user@example.com',
      password: 'password123',
    );
    
    if (loginResult.isSuccess) {
      // Use different services
      final userProfile = await serviceManager.user.getUserProfile();
      final contentList = await serviceManager.product.getContentList();
      
      print('User: ${userProfile?.username}');
      print('Content count: ${contentList.length}');
    }
    
    // Cleanup
    serviceManager.dispose();
  }
  
  /// Example 2: Using individual services
  static void individualServiceUsage(BuildContext context) async {
    // Create auth service
    final authService = AuthApiAppExampleService(context: context);
    
    // Login
    final loginResult = await authService.login(
      username: 'user@example.com',
      password: 'password123',
    );
    
    if (loginResult.isSuccess) {
      // Create other services
      final userService = UserApiAppExampleService(context);
      final productService = ProductApiAppExampleService(context);
      
      // Use services
      final userProfile = await userService.getUserProfile();
      final contentList = await productService.getContentList();
      
      print('User: ${userProfile?.username}');
      print('Content count: ${contentList.length}');
    }
    
    // Cleanup
    authService.dispose();
  }
  
  /// Example 3: Error handling
  static void errorHandlingExample(BuildContext context) async {
    final serviceManager = AppExampleServiceManager(context: context);
    
    try {
      // Attempt to access protected resource without login
      final userProfile = await serviceManager.user.getUserProfile();
      
      if (userProfile == null) {
        print('User not authenticated, redirecting to login...');
        // Handle authentication required
      }
    } catch (e) {
      print('Error: $e');
      // Handle other errors
    }
    
    serviceManager.dispose();
  }
}
