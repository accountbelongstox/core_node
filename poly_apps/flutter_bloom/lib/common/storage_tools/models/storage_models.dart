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


