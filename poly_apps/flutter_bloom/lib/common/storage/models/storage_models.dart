/// Descriptor for a change event in the storage layer.
class StorageChange {
  final String? key; // null means any key in the box
  final dynamic oldValue; // previous value
  final dynamic newValue; // new value
  final StorageChangeType type;
  final DateTime timestamp;

  StorageChange({
    this.key,
    this.oldValue,
    this.newValue,
    required this.type,
    required this.timestamp,
  });
}

/// Types of storage changes
enum StorageChangeType {
  created,
  updated,
  deleted,
}


