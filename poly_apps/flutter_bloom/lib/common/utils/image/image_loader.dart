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

// Migrated from lib/helper/image_loader_helper.dart
// This file provides image loading utilities for the application

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

class ImageLoader {
  /// Load image from assets
  static Future<ImageProvider> loadAssetImage(String assetPath) async {
    return AssetImage(assetPath);
  }

  /// Load image from network with error handling
  static ImageProvider loadNetworkImage(String url, {
    Map<String, String>? headers,
    double scale = 1.0,
  }) {
    return NetworkImage(url, headers: headers, scale: scale);
  }

  /// Load image from file
  static ImageProvider loadFileImage(File file) {
    return FileImage(file);
  }

  /// Load image from memory
  static ImageProvider loadMemoryImage(Uint8List bytes) {
    return MemoryImage(bytes);
  }

  /// Get image bytes from asset
  static Future<Uint8List> getAssetImageBytes(String assetPath) async {
    final ByteData data = await rootBundle.load(assetPath);
    return data.buffer.asUint8List();
  }

  /// Check if image URL is valid
  static bool isValidImageUrl(String url) {
    if (url.isEmpty) return false;
    
    try {
      final uri = Uri.parse(url);
      if (!uri.hasScheme) return false;
      
      final validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      final path = uri.path.toLowerCase();
      
      return validExtensions.any((ext) => path.endsWith(ext));
    } catch (e) {
      return false;
    }
  }

  /// Get image provider with fallback
  static ImageProvider getImageWithFallback(
    String? imageUrl, {
    String? fallbackAsset,
    ImageProvider? fallbackProvider,
  }) {
    if (imageUrl != null && imageUrl.isNotEmpty && isValidImageUrl(imageUrl)) {
      return NetworkImage(imageUrl);
    }
    
    if (fallbackProvider != null) {
      return fallbackProvider;
    }
    
    if (fallbackAsset != null) {
      return AssetImage(fallbackAsset);
    }
    
    // Default fallback
    return const AssetImage('assets/common/images/placeholder.png');
  }

  /// Create cached network image provider
  static ImageProvider getCachedNetworkImage(String url) {
    // For web, use regular NetworkImage
    if (kIsWeb) {
      return NetworkImage(url);
    }
    
    // For mobile, you might want to use cached_network_image package
    // For now, using regular NetworkImage
    return NetworkImage(url);
  }

  /// Preload image
  static Future<void> preloadImage(
    BuildContext context,
    ImageProvider imageProvider,
  ) async {
    await precacheImage(imageProvider, context);
  }

  /// Preload multiple images
  static Future<void> preloadImages(
    BuildContext context,
    List<ImageProvider> imageProviders,
  ) async {
    final futures = imageProviders.map(
      (provider) => precacheImage(provider, context),
    );
    await Future.wait(futures);
  }

  /// Get image size
  static Future<Size> getImageSize(ImageProvider imageProvider) async {
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

  /// Check if image exists in assets
  static Future<bool> assetExists(String assetPath) async {
    try {
      await rootBundle.load(assetPath);
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Get image aspect ratio
  static Future<double> getImageAspectRatio(ImageProvider imageProvider) async {
    final size = await getImageSize(imageProvider);
    return size.width / size.height;
  }

  /// Create image widget with error handling
  static Widget createImageWidget(
    String? imageUrl, {
    String? fallbackAsset,
    double? width,
    double? height,
    BoxFit fit = BoxFit.cover,
    Widget? errorWidget,
    Widget? loadingWidget,
  }) {
    if (imageUrl == null || imageUrl.isEmpty) {
      if (fallbackAsset != null) {
        return Image.asset(
          fallbackAsset,
          width: width,
          height: height,
          fit: fit,
          errorBuilder: (context, error, stackTrace) {
            return errorWidget ?? const Icon(Icons.error);
          },
        );
      }
      return errorWidget ?? const Icon(Icons.image_not_supported);
    }

    if (isValidImageUrl(imageUrl)) {
      return Image.network(
        imageUrl,
        width: width,
        height: height,
        fit: fit,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return loadingWidget ?? 
            Center(
              child: CircularProgressIndicator(
                value: loadingProgress.expectedTotalBytes != null
                    ? loadingProgress.cumulativeBytesLoaded /
                        loadingProgress.expectedTotalBytes!
                    : null,
              ),
            );
        },
        errorBuilder: (context, error, stackTrace) {
          if (fallbackAsset != null) {
            return Image.asset(
              fallbackAsset,
              width: width,
              height: height,
              fit: fit,
            );
          }
          return errorWidget ?? const Icon(Icons.error);
        },
      );
    }

    return errorWidget ?? const Icon(Icons.image_not_supported);
  }

  /// Get image format from URL
  static String? getImageFormat(String url) {
    try {
      final uri = Uri.parse(url);
      final path = uri.path.toLowerCase();
      
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'JPEG';
      if (path.endsWith('.png')) return 'PNG';
      if (path.endsWith('.gif')) return 'GIF';
      if (path.endsWith('.bmp')) return 'BMP';
      if (path.endsWith('.webp')) return 'WEBP';
      
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Check if image format is supported
  static bool isFormatSupported(String format) {
    const supportedFormats = ['JPEG', 'PNG', 'GIF', 'BMP', 'WEBP'];
    return supportedFormats.contains(format.toUpperCase());
  }

  /// Build avatar image widget with network support and fallback
  static Widget buildAvatarImage({
    required String? imageUrl,
    required String baseUrl,
    required double size,
    String? defaultImage,
    BoxFit fit = BoxFit.cover,
    Color backgroundColor = Colors.transparent,
    Duration fadeInDuration = const Duration(milliseconds: 300),
    bool isCircle = true,
    BorderRadius? borderRadius,
  }) {
    Widget image;
    if (imageUrl == null) {
      image = Image.asset(
        defaultImage ?? 'assets/common/images/profile_placeholder.png',
        width: size,
        height: size,
        fit: fit,
      );
    } else {
      image = FadeInImage.assetNetwork(
        placeholder: defaultImage ?? 'assets/common/images/profile_placeholder.png',
        image: '$baseUrl/$imageUrl',
        width: size,
        height: size,
        fit: fit,
        fadeInDuration: fadeInDuration,
        imageErrorBuilder: (context, error, stackTrace) {
          debugPrint('Error loading avatar image: $error');
          return Image.asset(
            defaultImage ?? 'assets/common/images/profile_placeholder.png',
            width: size,
            height: size,
            fit: fit,
          );
        },
      );
    }

    if (isCircle) {
      return ClipOval(child: image);
    } else if (borderRadius != null) {
      return ClipRRect(
        borderRadius: borderRadius,
        child: image,
      );
    }

    return image;
  }
}
