// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/foundation.dart';
import '../../../common/provider_status/user_provider.dart';
import '../models_app_wuy/user_model_app_wuy.dart';
import '../services_app_wuy/wuy_fake_data_generator.dart';
import '../services_app_wuy/wuy_auth_state_manager.dart';

class WuUserProvider extends EnhancedUserProvider {
  static const String _namespace = 'app_wuy';

  WuUserProvider() : super(appNamespace: _namespace) {
    // Don't initialize fake user automatically to avoid web entrypoint issues
    // Fake user will be created only when explicitly needed for testing
    // Storage will be initialized by runCommonApp
  }

  /// Initialize fake user for testing (call explicitly when needed)
  void initializeFakeUserForTesting() {
    // Check if user is already authenticated
    if (isAuthenticated) {
      return;
    }
    
    // Create a fake user for testing using independent fake data generator
    final fakeUser = WuyFakeDataGenerator.generateTestUser();
    setAppUser(profile: fakeUser);
  }

  UserModelAppWuy? get appProfile {
    // UserModelAppWuy now extends LaravelUserModel, so we can cast directly
    return user as UserModelAppWuy?;
  }

  Map<String, dynamic> get permissionMetadata {
    return <String, dynamic>{
      'verifiedGroups': verifiedPermissionGroups.toList(),
      'claims': authMetadata.data['claims'] ?? const <String>[],
      'clientPermissionGranted': clientPermissionGranted,
      'authType': authMetadata.authType.name,
    };
  }

  void setAppUser({
    required UserModelAppWuy profile,
    AuthMetadata? metadata,
  }) {
    // UserModelAppWuy now extends LaravelUserModel, so we can use it directly
    setUser(profile);
    if (metadata != null) {
      setAuthMetadata(metadata);
    }
    
    // Use auth state manager for consistent state management
    WuyAuthStateManager.instance.setAuthenticatedUser(profile);
  }

  /// Sync with auth state manager (called from external services)
  void syncWithAuthStateManager() {
    final authStateManager = WuyAuthStateManager.instance;
    if (authStateManager.isAuthenticated && authStateManager.currentUser != null) {
      setUser(authStateManager.currentUser!);
      debugPrint('WuUserProvider: Synced with auth state manager - user: ${authStateManager.currentUser!.displayName}');
    } else if (!authStateManager.isAuthenticated) {
      clearUser();
      debugPrint('WuUserProvider: Synced with auth state manager - cleared user');
    }
  }
  

  void upsertPreference(String key, dynamic value) {
    final UserModelAppWuy? currentUser = appProfile;
    if (currentUser == null) {
      return;
    }
    final Map<String, dynamic> preferences = Map<String, dynamic>.from(currentUser.preferences);
    preferences[key] = value;
    final UserModelAppWuy updated = currentUser.copyWith(preferences: preferences);
    setUser(updated);
    
    // Use auth state manager for consistent state management
    WuyAuthStateManager.instance.setAuthenticatedUser(updated);
  }

}
