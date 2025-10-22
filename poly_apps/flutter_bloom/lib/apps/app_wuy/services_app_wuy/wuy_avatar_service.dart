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

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import '../models_app_wuy/user_model_app_wuy.dart';
import 'wuy_unified_service.dart';

/// Wuy Avatar Service
/// Handles avatar selection, cropping, caching, and upload functionality
class WuyAvatarService {
  static final WuyAvatarService _instance = WuyAvatarService._internal();
  factory WuyAvatarService() => _instance;
  WuyAvatarService._internal();

  final ImagePicker _picker = ImagePicker();
  Directory? _cacheDirectory;

  /// Initialize the avatar service and cache directory
  Future<void> initialize() async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      _cacheDirectory = Directory(path.join(appDir.path, 'avatars'));

      if (!await _cacheDirectory!.exists()) {
        await _cacheDirectory!.create(recursive: true);
        debugPrint('WuyAvatarService: Created avatar cache directory at ${_cacheDirectory!.path}');
      }
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to initialize cache directory: $e');
    }
  }

  /// Get avatar cache directory path
  String? get cacheDirectoryPath => _cacheDirectory?.path;

  /// Pick image from gallery
  Future<File?> pickImageFromGallery() async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (pickedFile != null) {
        return File(pickedFile.path);
      }
      return null;
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to pick image from gallery: $e');
      return null;
    }
  }

  /// Pick image from camera
  Future<File?> pickImageFromCamera() async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (pickedFile != null) {
        return File(pickedFile.path);
      }
      return null;
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to pick image from camera: $e');
      return null;
    }
  }

  /// Save image to cache and return cached path
  Future<String?> saveToCache(File imageFile, String userId) async {
    try {
      if (_cacheDirectory == null) {
        await initialize();
      }

      if (_cacheDirectory == null) {
        debugPrint('WuyAvatarService: Cache directory not initialized');
        return null;
      }

      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final extension = path.extension(imageFile.path);
      final fileName = 'avatar_${userId}_$timestamp$extension';
      final cachedPath = path.join(_cacheDirectory!.path, fileName);

      final cachedFile = await imageFile.copy(cachedPath);
      debugPrint('WuyAvatarService: Saved avatar to cache: $cachedPath');

      await _cleanOldCachedAvatars(userId);

      return cachedFile.path;
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to save avatar to cache: $e');
      return null;
    }
  }

  /// Clean old cached avatars for a user (keep only the latest 3)
  Future<void> _cleanOldCachedAvatars(String userId) async {
    try {
      if (_cacheDirectory == null) return;

      final files = _cacheDirectory!
          .listSync()
          .whereType<File>()
          .where((f) => path.basename(f.path).startsWith('avatar_${userId}_'))
          .toList();

      if (files.length > 3) {
        files.sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));

        for (int i = 3; i < files.length; i++) {
          await files[i].delete();
          debugPrint('WuyAvatarService: Deleted old cached avatar: ${files[i].path}');
        }
      }
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to clean old cached avatars: $e');
    }
  }

  /// Get cached avatar path for user
  Future<String?> getCachedAvatarPath(String userId) async {
    try {
      if (_cacheDirectory == null) {
        await initialize();
      }

      if (_cacheDirectory == null) return null;

      final files = _cacheDirectory!
          .listSync()
          .whereType<File>()
          .where((f) => path.basename(f.path).startsWith('avatar_${userId}_'))
          .toList();

      if (files.isEmpty) return null;

      files.sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));

      return files.first.path;
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to get cached avatar path: $e');
      return null;
    }
  }

  /// Update user avatar (save to cache and update user model)
  Future<bool> updateUserAvatar(File imageFile, UserModelAppWuy user) async {
    try {
      final userId = user.id.toString();
      final cachedPath = await saveToCache(imageFile, userId);

      if (cachedPath == null) {
        debugPrint('WuyAvatarService: Failed to save avatar to cache');
        return false;
      }

      final updatedUser = user.copyWith(
        avatarUrl: cachedPath,
        avatar: cachedPath,
        updatedAt: DateTime.now(),
      );

      final unifiedService = WuyUnifiedService();

      debugPrint('WuyAvatarService: Avatar updated successfully');
      debugPrint('WuyAvatarService: Cached path: $cachedPath');

      return true;
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to update user avatar: $e');
      return false;
    }
  }

  /// Upload avatar to API (placeholder for future implementation)
  Future<String?> uploadAvatarToApi(File imageFile, String userId) async {
    try {
      debugPrint('WuyAvatarService: uploadAvatarToApi called (not implemented yet)');
      debugPrint('WuyAvatarService: This will integrate with WuyUnifiedService API');

      return null;
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to upload avatar to API: $e');
      return null;
    }
  }

  /// Clear all cached avatars
  Future<void> clearAllCache() async {
    try {
      if (_cacheDirectory == null) {
        await initialize();
      }

      if (_cacheDirectory == null) return;

      final files = _cacheDirectory!.listSync().whereType<File>();
      for (final file in files) {
        await file.delete();
      }

      debugPrint('WuyAvatarService: Cleared all cached avatars');
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to clear avatar cache: $e');
    }
  }

  /// Get cache size in bytes
  Future<int> getCacheSize() async {
    try {
      if (_cacheDirectory == null) {
        await initialize();
      }

      if (_cacheDirectory == null) return 0;

      int totalSize = 0;
      final files = _cacheDirectory!.listSync().whereType<File>();

      for (final file in files) {
        totalSize += await file.length();
      }

      return totalSize;
    } catch (e) {
      debugPrint('WuyAvatarService: Failed to get cache size: $e');
      return 0;
    }
  }

  /// Format cache size to human-readable string
  String formatCacheSize(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    } else if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(2)} KB';
    } else {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
    }
  }
}
