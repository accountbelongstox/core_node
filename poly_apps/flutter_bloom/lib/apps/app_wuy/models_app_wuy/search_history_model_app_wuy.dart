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

import 'search_filter_model_app_wuy.dart';
export 'search_filter_model_app_wuy.dart';

class SearchHistoryModelAppWuy {
  final String id;
  final String searchText;
  final DateTime timestamp;
  final SearchFilterModelAppWuy? filter;

  const SearchHistoryModelAppWuy({
    required this.id,
    required this.searchText,
    required this.timestamp,
    this.filter,
  });

  factory SearchHistoryModelAppWuy.fromJson(Map<String, dynamic> json) {
    return SearchHistoryModelAppWuy(
      id: json['id'] as String,
      searchText: json['searchText'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      filter: json['filter'] != null
          ? SearchFilterModelAppWuy.fromJson(json['filter'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'searchText': searchText,
      'timestamp': timestamp.toIso8601String(),
      'filter': filter?.toJson(),
    };
  }

  SearchHistoryModelAppWuy copyWith({
    String? id,
    String? searchText,
    DateTime? timestamp,
    SearchFilterModelAppWuy? filter,
  }) {
    return SearchHistoryModelAppWuy(
      id: id ?? this.id,
      searchText: searchText ?? this.searchText,
      timestamp: timestamp ?? this.timestamp,
      filter: filter ?? this.filter,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SearchHistoryModelAppWuy &&
        other.id == id &&
        other.searchText == searchText &&
        other.timestamp == timestamp &&
        other.filter == filter;
  }

  @override
  int get hashCode {
    return Object.hash(
      id,
      searchText,
      timestamp,
      filter,
    );
  }

  @override
  String toString() {
    return 'SearchHistoryModelAppWuy(id: $id, searchText: $searchText, timestamp: $timestamp)';
  }
}
