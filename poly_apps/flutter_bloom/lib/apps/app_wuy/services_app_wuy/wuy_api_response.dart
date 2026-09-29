/// Lightweight response wrapper used by Wuy services to avoid naming
/// collisions with the shared ApiResponse type from the network framework.
class WuyApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final String? errorCode;

  WuyApiResponse({
    required this.success,
    this.data,
    this.message,
    this.errorCode,
  });

  factory WuyApiResponse.success({
    T? data,
    required String message,
  }) {
    return WuyApiResponse(
      success: true,
      data: data,
      message: message,
    );
  }

  factory WuyApiResponse.error({
    required String message,
    String? errorCode,
  }) {
    return WuyApiResponse(
      success: false,
      message: message,
      errorCode: errorCode,
    );
  }
}
