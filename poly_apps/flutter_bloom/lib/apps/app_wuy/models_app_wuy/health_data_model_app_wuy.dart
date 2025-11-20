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

class HealthDataModelAppWuy {
  final String id;
  final String userId;
  final DateTime timestamp;
  final int? steps;
  final int? heartRate;
  final double? temperature;
  final int? bloodOxygen;
  final int? calories;
  final double? distance;
  final int? sleepDuration;
  final String? sleepQuality;
  final Map<String, dynamic>? metadata;

  const HealthDataModelAppWuy({
    required this.id,
    required this.userId,
    required this.timestamp,
    this.steps,
    this.heartRate,
    this.temperature,
    this.bloodOxygen,
    this.calories,
    this.distance,
    this.sleepDuration,
    this.sleepQuality,
    this.metadata,
  });

  factory HealthDataModelAppWuy.fromJson(Map<String, dynamic> json) {
    return HealthDataModelAppWuy(
      id: json['id'] as String,
      userId: json['user_id'] as String? ?? json['userId'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      steps: json['steps'] as int?,
      heartRate: json['heart_rate'] as int? ?? json['heartRate'] as int?,
      temperature: json['temperature'] != null ? (json['temperature'] as num).toDouble() : null,
      bloodOxygen: json['blood_oxygen'] as int? ?? json['bloodOxygen'] as int?,
      calories: json['calories'] as int?,
      distance: json['distance'] != null ? (json['distance'] as num).toDouble() : null,
      sleepDuration: json['sleep_duration'] as int? ?? json['sleepDuration'] as int?,
      sleepQuality: json['sleep_quality'] as String? ?? json['sleepQuality'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'timestamp': timestamp.toIso8601String(),
      'steps': steps,
      'heart_rate': heartRate,
      'temperature': temperature,
      'blood_oxygen': bloodOxygen,
      'calories': calories,
      'distance': distance,
      'sleep_duration': sleepDuration,
      'sleep_quality': sleepQuality,
      'metadata': metadata,
    };
  }

  HealthDataModelAppWuy copyWith({
    String? id,
    String? userId,
    DateTime? timestamp,
    int? steps,
    int? heartRate,
    double? temperature,
    int? bloodOxygen,
    int? calories,
    double? distance,
    int? sleepDuration,
    String? sleepQuality,
    Map<String, dynamic>? metadata,
  }) {
    return HealthDataModelAppWuy(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      timestamp: timestamp ?? this.timestamp,
      steps: steps ?? this.steps,
      heartRate: heartRate ?? this.heartRate,
      temperature: temperature ?? this.temperature,
      bloodOxygen: bloodOxygen ?? this.bloodOxygen,
      calories: calories ?? this.calories,
      distance: distance ?? this.distance,
      sleepDuration: sleepDuration ?? this.sleepDuration,
      sleepQuality: sleepQuality ?? this.sleepQuality,
      metadata: metadata ?? this.metadata,
    );
  }

  String get displaySteps {
    return steps != null ? '$steps steps' : 'N/A';
  }

  String get displayHeartRate {
    return heartRate != null ? '$heartRate bpm' : 'N/A';
  }

  String get displayTemperature {
    return temperature != null ? '${temperature!.toStringAsFixed(1)}°C' : 'N/A';
  }

  String get displayBloodOxygen {
    return bloodOxygen != null ? '$bloodOxygen%' : 'N/A';
  }

  String get displayCalories {
    return calories != null ? '$calories kcal' : 'N/A';
  }

  String get displayDistance {
    return distance != null ? '${distance!.toStringAsFixed(2)} km' : 'N/A';
  }

  String get displaySleepDuration {
    if (sleepDuration == null) return 'N/A';
    final hours = sleepDuration! ~/ 60;
    final minutes = sleepDuration! % 60;
    return '${hours}h ${minutes}m';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is HealthDataModelAppWuy && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'HealthDataModelAppWuy(id: $id, steps: $steps, heartRate: $heartRate, temperature: $temperature, bloodOxygen: $bloodOxygen)';
  }
}
