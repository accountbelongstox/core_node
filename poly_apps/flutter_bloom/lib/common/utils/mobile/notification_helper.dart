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

// Migrated from lib/helper/notification_helper.dart
// This file provides notification utilities for the application

import 'dart:developer';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import 'package:timezone/timezone.dart' as tz;

class NotificationHelper {
  static const String _channelId = 'qianyu_channel';
  static const String _channelName = 'Qianyu Notifications';
  static const String _channelDescription = 'Notifications for Qianyu app';

  /// Initialize notifications with default settings
  static Future<void> initialize(FlutterLocalNotificationsPlugin plugin) async {
    if (kIsWeb) return;

    try {
      const AndroidInitializationSettings initializationSettingsAndroid =
          AndroidInitializationSettings('notification_icon');

      const DarwinInitializationSettings initializationSettingsIOS =
          DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const InitializationSettings initializationSettings =
          InitializationSettings(
        android: initializationSettingsAndroid,
        iOS: initializationSettingsIOS,
      );

      await plugin.initialize(
        initializationSettings,
        onDidReceiveNotificationResponse: _onNotificationTapped,
      );

      // Create notification channel for Android
      if (Platform.isAndroid) {
        await _createNotificationChannel(plugin);
      }

      // Request permissions for iOS
      if (Platform.isIOS) {
        await _requestIOSPermissions(plugin);
      }

      log('Notifications initialized successfully');
    } catch (e) {
      log('Failed to initialize notifications: $e');
      rethrow;
    }
  }

  /// Initialize notifications with fallback icon
  static Future<void> initializeWithFallbackIcon(
      FlutterLocalNotificationsPlugin plugin) async {
    if (kIsWeb) return;

    try {
      const AndroidInitializationSettings initializationSettingsAndroid =
          AndroidInitializationSettings('@mipmap/ic_launcher');

      const DarwinInitializationSettings initializationSettingsIOS =
          DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const InitializationSettings initializationSettings =
          InitializationSettings(
        android: initializationSettingsAndroid,
        iOS: initializationSettingsIOS,
      );

      await plugin.initialize(
        initializationSettings,
        onDidReceiveNotificationResponse: _onNotificationTapped,
      );

      // Create notification channel for Android
      if (Platform.isAndroid) {
        await _createNotificationChannel(plugin);
      }

      // Request permissions for iOS
      if (Platform.isIOS) {
        await _requestIOSPermissions(plugin);
      }

      log('Notifications initialized with fallback icon');
    } catch (e) {
      log('Failed to initialize notifications with fallback: $e');
      rethrow;
    }
  }

  /// Create notification channel for Android
  static Future<void> _createNotificationChannel(
      FlutterLocalNotificationsPlugin plugin) async {
    if (!Platform.isAndroid) return;

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: _channelDescription,
      importance: Importance.high,
      enableVibration: true,
      playSound: true,
    );

    await plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  /// Request permissions for iOS
  static Future<bool> _requestIOSPermissions(
      FlutterLocalNotificationsPlugin plugin) async {
    if (!Platform.isIOS) return true;

    final result = await plugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );

    return result ?? false;
  }

  /// Handle notification tap
  static void _onNotificationTapped(NotificationResponse response) {
    log('Notification tapped: ${response.payload}');
    
    // Handle notification tap based on payload
    if (response.payload != null) {
      try {
        // You can add custom navigation logic here
        // For example: Get.toNamed(response.payload!);
      } catch (e) {
        log('Error handling notification tap: $e');
      }
    }
  }

  /// Show simple notification
  static Future<void> showNotification(
    FlutterLocalNotificationsPlugin plugin, {
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (kIsWeb) return;

    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDescription,
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      await plugin.show(id, title, body, details, payload: payload);
      log('Notification shown: $title');
    } catch (e) {
      log('Failed to show notification: $e');
    }
  }

  /// Show notification with image
  static Future<void> showNotificationWithImage(
    FlutterLocalNotificationsPlugin plugin, {
    required int id,
    required String title,
    required String body,
    required String imageUrl,
    String? payload,
  }) async {
    if (kIsWeb) return;

    try {
      final String imagePath = await _downloadAndSaveImage(imageUrl);

      final AndroidNotificationDetails androidDetails =
          AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDescription,
        importance: Importance.high,
        priority: Priority.high,
        showWhen: true,
        largeIcon: FilePathAndroidBitmap(imagePath),
        styleInformation: BigPictureStyleInformation(
          FilePathAndroidBitmap(imagePath),
          hideExpandedLargeIcon: true,
        ),
      );

      const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      final NotificationDetails details = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      await plugin.show(id, title, body, details, payload: payload);
      log('Notification with image shown: $title');
    } catch (e) {
      log('Failed to show notification with image: $e');
      // Fallback to simple notification
      await showNotification(
        plugin,
        id: id,
        title: title,
        body: body,
        payload: payload,
      );
    }
  }

  /// Download and save image for notification
  static Future<String> _downloadAndSaveImage(String imageUrl) async {
    final response = await http.get(Uri.parse(imageUrl));
    final documentDirectory = await getApplicationDocumentsDirectory();
    final file = File('${documentDirectory.path}/notification_image.jpg');
    await file.writeAsBytes(response.bodyBytes);
    return file.path;
  }

  /// Schedule notification
  static Future<void> scheduleNotification(
    FlutterLocalNotificationsPlugin plugin, {
    required int id,
    required String title,
    required String body,
    required DateTime scheduledDate,
    String? payload,
  }) async {
    if (kIsWeb) return;

    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDescription,
      importance: Importance.high,
      priority: Priority.high,
    );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      await plugin.zonedSchedule(
        id,
        title,
        body,
        tz.TZDateTime.from(scheduledDate, tz.local),
        details,
        payload: payload,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      );
      log('Notification scheduled: $title for $scheduledDate');
    } catch (e) {
      log('Failed to schedule notification: $e');
    }
  }

  /// Cancel notification
  static Future<void> cancelNotification(
    FlutterLocalNotificationsPlugin plugin,
    int id,
  ) async {
    if (kIsWeb) return;

    try {
      await plugin.cancel(id);
      log('Notification cancelled: $id');
    } catch (e) {
      log('Failed to cancel notification: $e');
    }
  }

  /// Cancel all notifications
  static Future<void> cancelAllNotifications(
    FlutterLocalNotificationsPlugin plugin,
  ) async {
    if (kIsWeb) return;

    try {
      await plugin.cancelAll();
      log('All notifications cancelled');
    } catch (e) {
      log('Failed to cancel all notifications: $e');
    }
  }

  /// Check if notifications are enabled
  static Future<bool> areNotificationsEnabled(
    FlutterLocalNotificationsPlugin plugin,
  ) async {
    if (kIsWeb) return false;

    try {
      if (Platform.isAndroid) {
        final result = await plugin
            .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin>()
            ?.areNotificationsEnabled();
        return result ?? false;
      } else if (Platform.isIOS) {
        final result = await plugin
            .resolvePlatformSpecificImplementation<
                IOSFlutterLocalNotificationsPlugin>()
            ?.checkPermissions();
        return result?.isEnabled ?? false;
      }
      return false;
    } catch (e) {
      log('Failed to check notification permissions: $e');
      return false;
    }
  }
}
