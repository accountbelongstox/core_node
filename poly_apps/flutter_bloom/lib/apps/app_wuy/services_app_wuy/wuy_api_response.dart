// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
