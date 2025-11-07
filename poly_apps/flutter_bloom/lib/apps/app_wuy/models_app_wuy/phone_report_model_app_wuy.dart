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

import 'network_record_model_app_wuy.dart';

class AppUsageRecord {
  final String appName;
  final String packageName;
  final int usageDuration;
  final DateTime lastUsed;

  const AppUsageRecord({
    required this.appName,
    required this.packageName,
    required this.usageDuration,
    required this.lastUsed,
  });

  factory AppUsageRecord.fromJson(Map<String, dynamic> json) {
    return AppUsageRecord(
      appName: json['app_name'] as String? ?? json['appName'] as String,
      packageName: json['package_name'] as String? ?? json['packageName'] as String,
      usageDuration: json['usage_duration'] as int? ?? json['usageDuration'] as int,
      lastUsed: DateTime.parse(json['last_used'] as String? ?? json['lastUsed'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'app_name': appName,
      'package_name': packageName,
      'usage_duration': usageDuration,
      'last_used': lastUsed.toIso8601String(),
    };
  }

  String get formattedDuration {
    final hours = usageDuration ~/ 3600;
    final minutes = (usageDuration % 3600) ~/ 60;
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }
}

class PhoneReportModelAppWuy {
  final String id;
  final String userId;
  final DateTime reportDate;
  final int unlockCount;
  final int totalScreenTime;
  final List<NetworkRecordModelAppWuy> networkRecords;
  final List<AppUsageRecord> appUsageRecords;
  final int batteryLevel;
  final String? batteryStatus;
  final int callCount;
  final int smsCount;
  final Map<String, dynamic>? metadata;

  const PhoneReportModelAppWuy({
    required this.id,
    required this.userId,
    required this.reportDate,
    required this.unlockCount,
    required this.totalScreenTime,
    required this.networkRecords,
    required this.appUsageRecords,
    required this.batteryLevel,
    this.batteryStatus,
    required this.callCount,
    required this.smsCount,
    this.metadata,
  });

  factory PhoneReportModelAppWuy.fromJson(Map<String, dynamic> json) {
    return PhoneReportModelAppWuy(
      id: json['id'] as String,
      userId: json['user_id'] as String? ?? json['userId'] as String,
      reportDate: DateTime.parse(json['report_date'] as String? ?? json['reportDate'] as String),
      unlockCount: json['unlock_count'] as int? ?? json['unlockCount'] as int? ?? 0,
      totalScreenTime: json['total_screen_time'] as int? ?? json['totalScreenTime'] as int? ?? 0,
      networkRecords: (json['network_records'] as List<dynamic>? ?? json['networkRecords'] as List<dynamic>? ?? [])
          .map((e) => NetworkRecordModelAppWuy.fromJson(e as Map<String, dynamic>))
          .toList(),
      appUsageRecords: (json['app_usage_records'] as List<dynamic>? ?? json['appUsageRecords'] as List<dynamic>? ?? [])
          .map((e) => AppUsageRecord.fromJson(e as Map<String, dynamic>))
          .toList(),
      batteryLevel: json['battery_level'] as int? ?? json['batteryLevel'] as int? ?? 0,
      batteryStatus: json['battery_status'] as String? ?? json['batteryStatus'] as String?,
      callCount: json['call_count'] as int? ?? json['callCount'] as int? ?? 0,
      smsCount: json['sms_count'] as int? ?? json['smsCount'] as int? ?? 0,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'report_date': reportDate.toIso8601String(),
      'unlock_count': unlockCount,
      'total_screen_time': totalScreenTime,
      'network_records': networkRecords.map((e) => e.toJson()).toList(),
      'app_usage_records': appUsageRecords.map((e) => e.toJson()).toList(),
      'battery_level': batteryLevel,
      'battery_status': batteryStatus,
      'call_count': callCount,
      'sms_count': smsCount,
      'metadata': metadata,
    };
  }

  PhoneReportModelAppWuy copyWith({
    String? id,
    String? userId,
    DateTime? reportDate,
    int? unlockCount,
    int? totalScreenTime,
    List<NetworkRecordModelAppWuy>? networkRecords,
    List<AppUsageRecord>? appUsageRecords,
    int? batteryLevel,
    String? batteryStatus,
    int? callCount,
    int? smsCount,
    Map<String, dynamic>? metadata,
  }) {
    return PhoneReportModelAppWuy(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      reportDate: reportDate ?? this.reportDate,
      unlockCount: unlockCount ?? this.unlockCount,
      totalScreenTime: totalScreenTime ?? this.totalScreenTime,
      networkRecords: networkRecords ?? this.networkRecords,
      appUsageRecords: appUsageRecords ?? this.appUsageRecords,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      batteryStatus: batteryStatus ?? this.batteryStatus,
      callCount: callCount ?? this.callCount,
      smsCount: smsCount ?? this.smsCount,
      metadata: metadata ?? this.metadata,
    );
  }

  String get formattedScreenTime {
    final hours = totalScreenTime ~/ 3600;
    final minutes = (totalScreenTime % 3600) ~/ 60;
    return '${hours.toString().padLeft(2, '0')}h ${minutes.toString().padLeft(2, '0')}m';
  }

  String get displayBatteryLevel {
    return '$batteryLevel%';
  }

  String get displayUnlockCount {
    return '$unlockCount times';
  }

  int get networkChangeCount {
    return networkRecords.length;
  }

  int get totalAppUsageTime {
    return appUsageRecords.fold(0, (sum, record) => sum + record.usageDuration);
  }

  List<AppUsageRecord> get topApps {
    final sorted = List<AppUsageRecord>.from(appUsageRecords)
      ..sort((a, b) => b.usageDuration.compareTo(a.usageDuration));
    return sorted.take(5).toList();
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is PhoneReportModelAppWuy && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'PhoneReportModelAppWuy(id: $id, reportDate: $reportDate, unlockCount: $unlockCount, screenTime: $totalScreenTime)';
  }
}
