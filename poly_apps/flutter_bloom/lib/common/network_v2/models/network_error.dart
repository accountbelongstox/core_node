/// Represents a failure that occurred during networking.
class NetworkError implements Exception {
  NetworkError({
    this.message,
    this.statusCode,
    this.details,
    this.isNetworkError = false,
    this.original,
  });

  final String? message;
  final int? statusCode;
  final Map<String, dynamic>? details;
  final bool isNetworkError;
  final Object? original;

  @override
  String toString() {
    return 'NetworkError(statusCode: ' ', message: )';
  }
}
