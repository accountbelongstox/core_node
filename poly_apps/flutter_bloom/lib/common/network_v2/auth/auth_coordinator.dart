// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import '../models/auth_requirement.dart';
import '../models/network_request.dart';

class AuthCoordinatorResult {
  final Map<String, String> additionalHeaders;
  final Map<String, dynamic> metadata;
  final Map<String, dynamic> sessionUpdate;

  const AuthCoordinatorResult({
    this.additionalHeaders = const <String, String>{},
    this.metadata = const <String, dynamic>{},
    this.sessionUpdate = const <String, dynamic>{},
  });

  bool get isEmpty {
    return additionalHeaders.isEmpty &&
        metadata.isEmpty &&
        sessionUpdate.isEmpty;
  }
}

abstract class AuthCoordinator {
  Future<AuthCoordinatorResult> prepare({
    required AuthRequirement requirement,
    required NetworkRequest request,
  });
}

