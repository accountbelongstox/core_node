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

// Migrated from lib/util/get_platform.dart
// This file provides platform detection utilities for the application

import 'dart:io';
import 'package:flutter/foundation.dart';

class PlatformUtil {
  /// Check if running on web
  static bool get isWeb => kIsWeb;

  /// Check if running on mobile (iOS or Android)
  static bool get isMobile => !kIsWeb && (Platform.isIOS || Platform.isAndroid);

  /// Check if running on desktop (Windows, macOS, or Linux)
  static bool get isDesktop => !kIsWeb && (Platform.isWindows || Platform.isMacOS || Platform.isLinux);

  /// Check if running on iOS
  static bool get isIOS => !kIsWeb && Platform.isIOS;

  /// Check if running on Android
  static bool get isAndroid => !kIsWeb && Platform.isAndroid;

  /// Check if running on Windows
  static bool get isWindows => !kIsWeb && Platform.isWindows;

  /// Check if running on macOS
  static bool get isMacOS => !kIsWeb && Platform.isMacOS;

  /// Check if running on Linux
  static bool get isLinux => !kIsWeb && Platform.isLinux;

  /// Check if running on Fuchsia
  static bool get isFuchsia => !kIsWeb && Platform.isFuchsia;

  /// Get current platform name
  static String get platformName {
    if (kIsWeb) return 'Web';
    if (Platform.isIOS) return 'iOS';
    if (Platform.isAndroid) return 'Android';
    if (Platform.isWindows) return 'Windows';
    if (Platform.isMacOS) return 'macOS';
    if (Platform.isLinux) return 'Linux';
    if (Platform.isFuchsia) return 'Fuchsia';
    return 'Unknown';
  }

  /// Get platform type enum
  static PlatformType get platformType {
    if (kIsWeb) return PlatformType.web;
    if (Platform.isIOS) return PlatformType.ios;
    if (Platform.isAndroid) return PlatformType.android;
    if (Platform.isWindows) return PlatformType.windows;
    if (Platform.isMacOS) return PlatformType.macos;
    if (Platform.isLinux) return PlatformType.linux;
    if (Platform.isFuchsia) return PlatformType.fuchsia;
    return PlatformType.unknown;
  }

  /// Get platform category
  static PlatformCategory get platformCategory {
    if (kIsWeb) return PlatformCategory.web;
    if (isMobile) return PlatformCategory.mobile;
    if (isDesktop) return PlatformCategory.desktop;
    return PlatformCategory.unknown;
  }

  /// Check if platform supports file system
  static bool get supportsFileSystem => !kIsWeb;

  /// Check if platform supports camera
  static bool get supportsCamera => isMobile;

  /// Check if platform supports location services
  static bool get supportsLocation => isMobile || isDesktop;

  /// Check if platform supports push notifications
  static bool get supportsPushNotifications => isMobile || isWeb;

  /// Check if platform supports biometric authentication
  static bool get supportsBiometrics => isMobile;

  /// Check if platform supports app store
  static bool get supportsAppStore => isMobile;

  /// Check if platform supports window management
  static bool get supportsWindowManagement => isDesktop;

  /// Check if platform supports multiple windows
  static bool get supportsMultipleWindows => isDesktop;

  /// Check if platform supports system tray
  static bool get supportsSystemTray => isDesktop;

  /// Check if platform supports keyboard shortcuts
  static bool get supportsKeyboardShortcuts => isDesktop || isWeb;

  /// Check if platform supports drag and drop
  static bool get supportsDragAndDrop => isDesktop || isWeb;

  /// Check if platform supports right-click context menu
  static bool get supportsContextMenu => isDesktop || isWeb;

  /// Check if platform supports hover effects
  static bool get supportsHover => isDesktop || isWeb;

  /// Check if platform supports touch input
  static bool get supportsTouch => isMobile || (isWeb && !isDesktop);

  /// Check if platform supports mouse input
  static bool get supportsMouse => isDesktop || isWeb;

  /// Check if platform supports stylus input
  static bool get supportsStylus => isMobile;

  /// Check if platform supports haptic feedback
  static bool get supportsHaptics => isMobile;

  /// Check if platform supports device orientation
  static bool get supportsOrientation => isMobile;

  /// Check if platform supports accelerometer
  static bool get supportsAccelerometer => isMobile;

  /// Check if platform supports gyroscope
  static bool get supportsGyroscope => isMobile;

  /// Check if platform supports magnetometer
  static bool get supportsMagnetometer => isMobile;

  /// Check if platform supports proximity sensor
  static bool get supportsProximity => isMobile;

  /// Check if platform supports ambient light sensor
  static bool get supportsAmbientLight => isMobile;

  /// Check if platform supports barometer
  static bool get supportsBarometer => isMobile;

  /// Check if platform supports NFC
  static bool get supportsNFC => isAndroid;

  /// Check if platform supports Bluetooth
  static bool get supportsBluetooth => isMobile || isDesktop;

  /// Check if platform supports WiFi
  static bool get supportsWiFi => isMobile || isDesktop;

  /// Check if platform supports cellular data
  static bool get supportsCellular => isMobile;

  /// Check if platform supports background processing
  static bool get supportsBackgroundProcessing => isMobile || isDesktop;

  /// Check if platform supports local notifications
  static bool get supportsLocalNotifications => isMobile || isDesktop;

  /// Check if platform supports deep linking
  static bool get supportsDeepLinking => isMobile || isWeb;

  /// Check if platform supports sharing
  static bool get supportsSharing => isMobile;

  /// Check if platform supports printing
  static bool get supportsPrinting => isDesktop || isWeb;

  /// Check if platform supports clipboard
  static bool get supportsClipboard => true; // All platforms support clipboard

  /// Check if platform supports text selection
  static bool get supportsTextSelection => true; // All platforms support text selection

  /// Get operating system version (if available)
  static String get operatingSystemVersion {
    if (kIsWeb) return 'Web';
    try {
      return Platform.operatingSystemVersion;
    } catch (e) {
      return 'Unknown';
    }
  }

  /// Get number of processors (if available)
  static int get numberOfProcessors {
    if (kIsWeb) return 1; // Default for web
    try {
      return Platform.numberOfProcessors;
    } catch (e) {
      return 1;
    }
  }

  /// Get path separator for current platform
  static String get pathSeparator {
    if (kIsWeb) return '/';
    return Platform.pathSeparator;
  }

  /// Get line terminator for current platform
  static String get lineTerminator {
    if (kIsWeb) return '\n';
    return Platform.lineTerminator;
  }

  /// Get executable path (if available)
  static String get executablePath {
    if (kIsWeb) return '';
    try {
      return Platform.executable;
    } catch (e) {
      return '';
    }
  }

  /// Get resolved executable path (if available)
  static String get resolvedExecutablePath {
    if (kIsWeb) return '';
    try {
      return Platform.resolvedExecutable;
    } catch (e) {
      return '';
    }
  }

  /// Get script path (if available)
  static String get scriptPath {
    if (kIsWeb) return '';
    try {
      return Platform.script.path;
    } catch (e) {
      return '';
    }
  }

  /// Get environment variables (if available)
  static Map<String, String> get environment {
    if (kIsWeb) return <String, String>{};
    try {
      return Platform.environment;
    } catch (e) {
      return <String, String>{};
    }
  }

  /// Get locale name (if available)
  static String get localeName {
    if (kIsWeb) return 'en_US';
    try {
      return Platform.localeName;
    } catch (e) {
      return 'en_US';
    }
  }

  /// Check if running in debug mode
  static bool get isDebugMode => kDebugMode;

  /// Check if running in profile mode
  static bool get isProfileMode => kProfileMode;

  /// Check if running in release mode
  static bool get isReleaseMode => kReleaseMode;

  /// Get build mode
  static BuildMode get buildMode {
    if (kDebugMode) return BuildMode.debug;
    if (kProfileMode) return BuildMode.profile;
    if (kReleaseMode) return BuildMode.release;
    return BuildMode.unknown;
  }

  /// Get platform-specific file extension
  static String getExecutableExtension() {
    if (isWindows) return '.exe';
    return '';
  }

  /// Get platform-specific library extension
  static String getLibraryExtension() {
    if (isWindows) return '.dll';
    if (isMacOS) return '.dylib';
    if (isLinux) return '.so';
    return '';
  }

  /// Check if platform supports feature
  static bool supportsFeature(PlatformFeature feature) {
    switch (feature) {
      case PlatformFeature.fileSystem:
        return supportsFileSystem;
      case PlatformFeature.camera:
        return supportsCamera;
      case PlatformFeature.location:
        return supportsLocation;
      case PlatformFeature.pushNotifications:
        return supportsPushNotifications;
      case PlatformFeature.biometrics:
        return supportsBiometrics;
      case PlatformFeature.haptics:
        return supportsHaptics;
      case PlatformFeature.orientation:
        return supportsOrientation;
      case PlatformFeature.bluetooth:
        return supportsBluetooth;
      case PlatformFeature.nfc:
        return supportsNFC;
      case PlatformFeature.backgroundProcessing:
        return supportsBackgroundProcessing;
      case PlatformFeature.sharing:
        return supportsSharing;
      case PlatformFeature.printing:
        return supportsPrinting;
    }
  }
}

/// Enum for platform types
enum PlatformType {
  web,
  ios,
  android,
  windows,
  macos,
  linux,
  fuchsia,
  unknown,
}

/// Enum for platform categories
enum PlatformCategory {
  web,
  mobile,
  desktop,
  unknown,
}

/// Enum for build modes
enum BuildMode {
  debug,
  profile,
  release,
  unknown,
}

/// Enum for platform features
enum PlatformFeature {
  fileSystem,
  camera,
  location,
  pushNotifications,
  biometrics,
  haptics,
  orientation,
  bluetooth,
  nfc,
  backgroundProcessing,
  sharing,
  printing,
}
