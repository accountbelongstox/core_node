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
