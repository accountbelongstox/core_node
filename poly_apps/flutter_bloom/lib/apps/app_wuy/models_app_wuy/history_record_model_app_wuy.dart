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

enum HistoryRecordType {
  arrival,
  departure,
  staying,
  moving,
}

class HistoryRecordModelAppWuy {
  final String id;
  final String userId;
  final DateTime timestamp;
  final double? latitude;
  final double? longitude;
  final String? locationName;
  final String? address;
  final String? stayDuration;
  final double? totalDistance;
  final HistoryRecordType type;
  final String? description;
  final Map<String, dynamic>? metadata;

  const HistoryRecordModelAppWuy({
    required this.id,
    required this.userId,
    required this.timestamp,
    this.latitude,
    this.longitude,
    this.locationName,
    this.address,
    this.stayDuration,
    this.totalDistance,
    required this.type,
    this.description,
    this.metadata,
  });

  factory HistoryRecordModelAppWuy.fromJson(Map<String, dynamic> json) {
    return HistoryRecordModelAppWuy(
      id: json['id'] as String,
      userId: json['user_id'] as String? ?? json['userId'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      latitude: json['latitude'] != null ? (json['latitude'] as num).toDouble() : null,
      longitude: json['longitude'] != null ? (json['longitude'] as num).toDouble() : null,
      locationName: json['location_name'] as String? ?? json['locationName'] as String?,
      address: json['address'] as String?,
      stayDuration: json['stay_duration'] as String? ?? json['stayDuration'] as String?,
      totalDistance: json['total_distance'] != null ? (json['total_distance'] as num).toDouble() : json['totalDistance'] != null ? (json['totalDistance'] as num).toDouble() : null,
      type: HistoryRecordType.values.firstWhere(
        (e) => e.toString().split('.').last == json['type'],
        orElse: () => HistoryRecordType.staying,
      ),
      description: json['description'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'timestamp': timestamp.toIso8601String(),
      'latitude': latitude,
      'longitude': longitude,
      'location_name': locationName,
      'address': address,
      'stay_duration': stayDuration,
      'total_distance': totalDistance,
      'type': type.toString().split('.').last,
      'description': description,
      'metadata': metadata,
    };
  }

  HistoryRecordModelAppWuy copyWith({
    String? id,
    String? userId,
    DateTime? timestamp,
    double? latitude,
    double? longitude,
    String? locationName,
    String? address,
    String? stayDuration,
    double? totalDistance,
    HistoryRecordType? type,
    String? description,
    Map<String, dynamic>? metadata,
  }) {
    return HistoryRecordModelAppWuy(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      timestamp: timestamp ?? this.timestamp,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      locationName: locationName ?? this.locationName,
      address: address ?? this.address,
      stayDuration: stayDuration ?? this.stayDuration,
      totalDistance: totalDistance ?? this.totalDistance,
      type: type ?? this.type,
      description: description ?? this.description,
      metadata: metadata ?? this.metadata,
    );
  }

  String get formattedDate {
    return '${timestamp.year}-${timestamp.month.toString().padLeft(2, '0')}-${timestamp.day.toString().padLeft(2, '0')}';
  }

  String get formattedTime {
    return '${timestamp.hour.toString().padLeft(2, '0')}:${timestamp.minute.toString().padLeft(2, '0')}';
  }

  String get displayLocationName {
    return locationName ?? address ?? 'Unknown Location';
  }

  String get displayStayDuration {
    return stayDuration ?? '0 minutes';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is HistoryRecordModelAppWuy && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'HistoryRecordModelAppWuy(id: $id, timestamp: $timestamp, locationName: $locationName, stayDuration: $stayDuration)';
  }
}
