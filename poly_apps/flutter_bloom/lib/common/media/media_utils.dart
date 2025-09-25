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

import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';

class MediaUtils {
  static const List<String> audioExtensions = [
    '.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.wma'
  ];

  static const List<String> videoExtensions = [
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'
  ];

  static const List<String> imageExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff'
  ];

  /// Check if file is an audio file based on extension
  static bool isAudioFile(String filePath) {
    final extension = _getFileExtension(filePath);
    return audioExtensions.contains(extension);
  }

  /// Check if file is a video file based on extension
  static bool isVideoFile(String filePath) {
    final extension = _getFileExtension(filePath);
    return videoExtensions.contains(extension);
  }

  /// Check if file is an image file based on extension
  static bool isImageFile(String filePath) {
    final extension = _getFileExtension(filePath);
    return imageExtensions.contains(extension);
  }

  /// Get file extension in lowercase
  static String _getFileExtension(String filePath) {
    final lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex == -1) return '';
    return filePath.substring(lastDotIndex).toLowerCase();
  }

  /// Get media type from file path
  static MediaType getMediaType(String filePath) {
    if (isAudioFile(filePath)) return MediaType.audio;
    if (isVideoFile(filePath)) return MediaType.video;
    if (isImageFile(filePath)) return MediaType.image;
    return MediaType.unknown;
  }

  /// Format duration to readable string (MM:SS or HH:MM:SS)
  static String formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:'
             '${minutes.toString().padLeft(2, '0')}:'
             '${seconds.toString().padLeft(2, '0')}';
    } else {
      return '${minutes.toString().padLeft(2, '0')}:'
             '${seconds.toString().padLeft(2, '0')}';
    }
  }

  /// Format file size to readable string
  static String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// Get file size
  static Future<int> getFileSize(String filePath) async {
    try {
      if (kIsWeb) {
        // Web implementation would need different approach
        return 0;
      } else {
        final file = File(filePath);
        if (await file.exists()) {
          return await file.length();
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error getting file size: $e');
      }
    }
    return 0;
  }

  /// Check if file exists
  static Future<bool> fileExists(String filePath) async {
    try {
      if (kIsWeb) {
        // Web implementation would need different approach
        return false;
      } else {
        final file = File(filePath);
        return await file.exists();
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error checking file existence: $e');
      }
      return false;
    }
  }

  /// Delete file
  static Future<bool> deleteFile(String filePath) async {
    try {
      if (kIsWeb) {
        // Web implementation would need different approach
        return false;
      } else {
        final file = File(filePath);
        if (await file.exists()) {
          await file.delete();
          return true;
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error deleting file: $e');
      }
    }
    return false;
  }

  /// Copy file to new location
  static Future<bool> copyFile(String sourcePath, String destinationPath) async {
    try {
      if (kIsWeb) {
        // Web implementation would need different approach
        return false;
      } else {
        final sourceFile = File(sourcePath);
        if (await sourceFile.exists()) {
          await sourceFile.copy(destinationPath);
          return true;
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error copying file: $e');
      }
    }
    return false;
  }

  /// Move file to new location
  static Future<bool> moveFile(String sourcePath, String destinationPath) async {
    try {
      if (kIsWeb) {
        // Web implementation would need different approach
        return false;
      } else {
        final sourceFile = File(sourcePath);
        if (await sourceFile.exists()) {
          await sourceFile.rename(destinationPath);
          return true;
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error moving file: $e');
      }
    }
    return false;
  }

  /// Read file as bytes
  static Future<Uint8List?> readFileAsBytes(String filePath) async {
    try {
      if (kIsWeb) {
        // Web implementation would need different approach
        return null;
      } else {
        final file = File(filePath);
        if (await file.exists()) {
          return await file.readAsBytes();
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error reading file as bytes: $e');
      }
    }
    return null;
  }

  /// Write bytes to file
  static Future<bool> writeBytesToFile(String filePath, Uint8List bytes) async {
    try {
      if (kIsWeb) {
        // Web implementation would need different approach
        return false;
      } else {
        final file = File(filePath);
        await file.writeAsBytes(bytes);
        return true;
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error writing bytes to file: $e');
      }
    }
    return false;
  }

  /// Get MIME type from file extension
  static String getMimeType(String filePath) {
    final extension = _getFileExtension(filePath);
    
    // Audio MIME types
    switch (extension) {
      case '.mp3': return 'audio/mpeg';
      case '.wav': return 'audio/wav';
      case '.aac': return 'audio/aac';
      case '.m4a': return 'audio/mp4';
      case '.ogg': return 'audio/ogg';
      case '.flac': return 'audio/flac';
      case '.wma': return 'audio/x-ms-wma';
    }
    
    // Video MIME types
    switch (extension) {
      case '.mp4': return 'video/mp4';
      case '.avi': return 'video/x-msvideo';
      case '.mov': return 'video/quicktime';
      case '.wmv': return 'video/x-ms-wmv';
      case '.flv': return 'video/x-flv';
      case '.webm': return 'video/webm';
      case '.mkv': return 'video/x-matroska';
      case '.m4v': return 'video/x-m4v';
    }
    
    // Image MIME types
    switch (extension) {
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.png': return 'image/png';
      case '.gif': return 'image/gif';
      case '.bmp': return 'image/bmp';
      case '.webp': return 'image/webp';
      case '.svg': return 'image/svg+xml';
      case '.tiff': return 'image/tiff';
    }
    
    return 'application/octet-stream';
  }

  /// Validate media file
  static Future<MediaValidationResult> validateMediaFile(String filePath) async {
    final result = MediaValidationResult();
    
    try {
      // Check if file exists
      if (!await fileExists(filePath)) {
        result.isValid = false;
        result.errors.add('File does not exist');
        return result;
      }
      
      // Check file size
      final fileSize = await getFileSize(filePath);
      if (fileSize == 0) {
        result.isValid = false;
        result.errors.add('File is empty');
        return result;
      }
      
      // Check if it's a supported media type
      final mediaType = getMediaType(filePath);
      if (mediaType == MediaType.unknown) {
        result.isValid = false;
        result.errors.add('Unsupported file type');
        return result;
      }
      
      result.isValid = true;
      result.mediaType = mediaType;
      result.fileSize = fileSize;
      result.mimeType = getMimeType(filePath);
      
    } catch (e) {
      result.isValid = false;
      result.errors.add('Error validating file: $e');
    }
    
    return result;
  }
}

enum MediaType {
  audio,
  video,
  image,
  unknown
}

class MediaValidationResult {
  bool isValid = false;
  MediaType? mediaType;
  int fileSize = 0;
  String? mimeType;
  List<String> errors = [];
}
