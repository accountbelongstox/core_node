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

enum NetworkType {
  wifi,
  mobile,
  ethernet,
  unknown,
}

enum NetworkStatus {
  connected,
  disconnected,
  connecting,
  failed,
}

class NetworkRecordModelAppWuy {
  final String id;
  final String userId;
  final DateTime timestamp;
  final NetworkType type;
  final NetworkStatus status;
  final String? wifiSsid;
  final String? wifiBssid;
  final int? signalStrength;
  final String? carrierName;
  final String? networkGeneration;
  final String? ipAddress;
  final String? description;
  final Map<String, dynamic>? metadata;

  const NetworkRecordModelAppWuy({
    required this.id,
    required this.userId,
    required this.timestamp,
    required this.type,
    required this.status,
    this.wifiSsid,
    this.wifiBssid,
    this.signalStrength,
    this.carrierName,
    this.networkGeneration,
    this.ipAddress,
    this.description,
    this.metadata,
  });

  factory NetworkRecordModelAppWuy.fromJson(Map<String, dynamic> json) {
    return NetworkRecordModelAppWuy(
      id: json['id'] as String,
      userId: json['user_id'] as String? ?? json['userId'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      type: NetworkType.values.firstWhere(
        (e) => e.toString().split('.').last == json['type'],
        orElse: () => NetworkType.unknown,
      ),
      status: NetworkStatus.values.firstWhere(
        (e) => e.toString().split('.').last == json['status'],
        orElse: () => NetworkStatus.disconnected,
      ),
      wifiSsid: json['wifi_ssid'] as String? ?? json['wifiSsid'] as String?,
      wifiBssid: json['wifi_bssid'] as String? ?? json['wifiBssid'] as String?,
      signalStrength: json['signal_strength'] as int? ?? json['signalStrength'] as int?,
      carrierName: json['carrier_name'] as String? ?? json['carrierName'] as String?,
      networkGeneration: json['network_generation'] as String? ?? json['networkGeneration'] as String?,
      ipAddress: json['ip_address'] as String? ?? json['ipAddress'] as String?,
      description: json['description'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'timestamp': timestamp.toIso8601String(),
      'type': type.toString().split('.').last,
      'status': status.toString().split('.').last,
      'wifi_ssid': wifiSsid,
      'wifi_bssid': wifiBssid,
      'signal_strength': signalStrength,
      'carrier_name': carrierName,
      'network_generation': networkGeneration,
      'ip_address': ipAddress,
      'description': description,
      'metadata': metadata,
    };
  }

  NetworkRecordModelAppWuy copyWith({
    String? id,
    String? userId,
    DateTime? timestamp,
    NetworkType? type,
    NetworkStatus? status,
    String? wifiSsid,
    String? wifiBssid,
    int? signalStrength,
    String? carrierName,
    String? networkGeneration,
    String? ipAddress,
    String? description,
    Map<String, dynamic>? metadata,
  }) {
    return NetworkRecordModelAppWuy(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      timestamp: timestamp ?? this.timestamp,
      type: type ?? this.type,
      status: status ?? this.status,
      wifiSsid: wifiSsid ?? this.wifiSsid,
      wifiBssid: wifiBssid ?? this.wifiBssid,
      signalStrength: signalStrength ?? this.signalStrength,
      carrierName: carrierName ?? this.carrierName,
      networkGeneration: networkGeneration ?? this.networkGeneration,
      ipAddress: ipAddress ?? this.ipAddress,
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

  String get displayNetworkType {
    switch (type) {
      case NetworkType.wifi:
        return wifiSsid != null ? 'WiFi: $wifiSsid' : 'WiFi';
      case NetworkType.mobile:
        return networkGeneration != null ? 'Mobile ($networkGeneration)' : 'Mobile Network';
      case NetworkType.ethernet:
        return 'Ethernet';
      case NetworkType.unknown:
        return 'Unknown Network';
    }
  }

  String get displayStatus {
    switch (status) {
      case NetworkStatus.connected:
        return 'Connected';
      case NetworkStatus.disconnected:
        return 'Disconnected';
      case NetworkStatus.connecting:
        return 'Connecting';
      case NetworkStatus.failed:
        return 'Failed';
    }
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is NetworkRecordModelAppWuy && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'NetworkRecordModelAppWuy(id: $id, type: $type, status: $status, wifiSsid: $wifiSsid)';
  }
}
