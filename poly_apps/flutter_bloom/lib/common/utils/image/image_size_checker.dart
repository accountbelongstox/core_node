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

// Migrated from lib/helper/image_size_checker_helper.dart
// This file provides image size checking utilities for the application

import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';

class ImageSizeChecker {
  /// Check if image file size is within limit
  static bool isFileSizeValid(File file, int maxSizeInBytes) {
    try {
      final fileSize = file.lengthSync();
      return fileSize <= maxSizeInBytes;
    } catch (e) {
      return false;
    }
  }

  /// Check if image bytes size is within limit
  static bool isBytesSizeValid(Uint8List bytes, int maxSizeInBytes) {
    return bytes.length <= maxSizeInBytes;
  }

  /// Get file size in bytes
  static int getFileSize(File file) {
    try {
      return file.lengthSync();
    } catch (e) {
      return 0;
    }
  }

  /// Get bytes size
  static int getBytesSize(Uint8List bytes) {
    return bytes.length;
  }

  /// Format file size to human readable string
  static String formatFileSize(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    } else if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    } else {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
    }
  }

  /// Check if image dimensions are within limits
  static Future<bool> areDimensionsValid(
    ImageProvider imageProvider, {
    int? maxWidth,
    int? maxHeight,
    int? minWidth,
    int? minHeight,
  }) async {
    try {
      final size = await _getImageSize(imageProvider);
      
      if (maxWidth != null && size.width > maxWidth) return false;
      if (maxHeight != null && size.height > maxHeight) return false;
      if (minWidth != null && size.width < minWidth) return false;
      if (minHeight != null && size.height < minHeight) return false;
      
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Get image dimensions
  static Future<Size> getImageDimensions(ImageProvider imageProvider) async {
    return await _getImageSize(imageProvider);
  }

  /// Check if image aspect ratio is within range
  static Future<bool> isAspectRatioValid(
    ImageProvider imageProvider, {
    double? minAspectRatio,
    double? maxAspectRatio,
  }) async {
    try {
      final size = await _getImageSize(imageProvider);
      final aspectRatio = size.width / size.height;
      
      if (minAspectRatio != null && aspectRatio < minAspectRatio) return false;
      if (maxAspectRatio != null && aspectRatio > maxAspectRatio) return false;
      
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Get image aspect ratio
  static Future<double> getAspectRatio(ImageProvider imageProvider) async {
    final size = await _getImageSize(imageProvider);
    return size.width / size.height;
  }

  /// Check if image is square
  static Future<bool> isSquare(ImageProvider imageProvider) async {
    final size = await _getImageSize(imageProvider);
    return size.width == size.height;
  }

  /// Check if image is landscape
  static Future<bool> isLandscape(ImageProvider imageProvider) async {
    final size = await _getImageSize(imageProvider);
    return size.width > size.height;
  }

  /// Check if image is portrait
  static Future<bool> isPortrait(ImageProvider imageProvider) async {
    final size = await _getImageSize(imageProvider);
    return size.height > size.width;
  }

  /// Get image orientation
  static Future<ImageOrientation> getOrientation(ImageProvider imageProvider) async {
    final size = await _getImageSize(imageProvider);
    
    if (size.width == size.height) {
      return ImageOrientation.square;
    } else if (size.width > size.height) {
      return ImageOrientation.landscape;
    } else {
      return ImageOrientation.portrait;
    }
  }

  /// Calculate image resolution (megapixels)
  static Future<double> getResolution(ImageProvider imageProvider) async {
    final size = await _getImageSize(imageProvider);
    return (size.width * size.height) / 1000000; // Convert to megapixels
  }

  /// Check if image resolution is within limits
  static Future<bool> isResolutionValid(
    ImageProvider imageProvider, {
    double? minMegapixels,
    double? maxMegapixels,
  }) async {
    try {
      final resolution = await getResolution(imageProvider);
      
      if (minMegapixels != null && resolution < minMegapixels) return false;
      if (maxMegapixels != null && resolution > maxMegapixels) return false;
      
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Validate image with multiple criteria
  static Future<ImageValidationResult> validateImage(
    ImageProvider imageProvider, {
    int? maxFileSizeBytes,
    int? maxWidth,
    int? maxHeight,
    int? minWidth,
    int? minHeight,
    double? minAspectRatio,
    double? maxAspectRatio,
    double? minMegapixels,
    double? maxMegapixels,
  }) async {
    final errors = <String>[];
    
    try {
      final size = await _getImageSize(imageProvider);
      
      // Check dimensions
      if (maxWidth != null && size.width > maxWidth) {
        errors.add('Width exceeds maximum limit of $maxWidth pixels');
      }
      if (maxHeight != null && size.height > maxHeight) {
        errors.add('Height exceeds maximum limit of $maxHeight pixels');
      }
      if (minWidth != null && size.width < minWidth) {
        errors.add('Width is below minimum limit of $minWidth pixels');
      }
      if (minHeight != null && size.height < minHeight) {
        errors.add('Height is below minimum limit of $minHeight pixels');
      }
      
      // Check aspect ratio
      final aspectRatio = size.width / size.height;
      if (minAspectRatio != null && aspectRatio < minAspectRatio) {
        errors.add('Aspect ratio is below minimum of $minAspectRatio');
      }
      if (maxAspectRatio != null && aspectRatio > maxAspectRatio) {
        errors.add('Aspect ratio exceeds maximum of $maxAspectRatio');
      }
      
      // Check resolution
      final resolution = (size.width * size.height) / 1000000;
      if (minMegapixels != null && resolution < minMegapixels) {
        errors.add('Resolution is below minimum of $minMegapixels MP');
      }
      if (maxMegapixels != null && resolution > maxMegapixels) {
        errors.add('Resolution exceeds maximum of $maxMegapixels MP');
      }
      
      return ImageValidationResult(
        isValid: errors.isEmpty,
        errors: errors,
        width: size.width.toInt(),
        height: size.height.toInt(),
        aspectRatio: aspectRatio,
        resolution: resolution,
      );
    } catch (e) {
      return ImageValidationResult(
        isValid: false,
        errors: ['Failed to analyze image: ${e.toString()}'],
      );
    }
  }

  /// Helper method to get image size
  static Future<Size> _getImageSize(ImageProvider imageProvider) async {
    final Completer<Size> completer = Completer<Size>();
    final ImageStream stream = imageProvider.resolve(ImageConfiguration.empty);
    
    late ImageStreamListener listener;
    listener = ImageStreamListener((ImageInfo info, bool _) {
      final Size size = Size(
        info.image.width.toDouble(),
        info.image.height.toDouble(),
      );
      stream.removeListener(listener);
      completer.complete(size);
    });
    
    stream.addListener(listener);
    return completer.future;
  }

  /// Convert bytes to different units
  static double bytesToKB(int bytes) => bytes / 1024;
  static double bytesToMB(int bytes) => bytes / (1024 * 1024);
  static double bytesToGB(int bytes) => bytes / (1024 * 1024 * 1024);
  
  /// Convert from different units to bytes
  static int kbToBytes(double kb) => (kb * 1024).round();
  static int mbToBytes(double mb) => (mb * 1024 * 1024).round();
  static int gbToBytes(double gb) => (gb * 1024 * 1024 * 1024).round();
}

/// Enum for image orientation
enum ImageOrientation {
  portrait,
  landscape,
  square,
}

/// Result class for image validation
class ImageValidationResult {
  final bool isValid;
  final List<String> errors;
  final int? width;
  final int? height;
  final double? aspectRatio;
  final double? resolution;

  const ImageValidationResult({
    required this.isValid,
    required this.errors,
    this.width,
    this.height,
    this.aspectRatio,
    this.resolution,
  });

  @override
  String toString() {
    return 'ImageValidationResult(isValid: $isValid, errors: $errors, '
           'width: $width, height: $height, aspectRatio: $aspectRatio, '
           'resolution: $resolution)';
  }
}
