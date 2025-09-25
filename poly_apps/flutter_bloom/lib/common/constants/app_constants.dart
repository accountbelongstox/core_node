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

class AppConstants {
  static const String appName = 'QianYu Words';

  static const String debugHeaderType = "Auth-Debug-Token";
  static const String authUserTokenHeaderType = "Auth-User-Token";
  static const String authUserHeaderType = "Auth-Username";
  static const String authPasswordHeaderType = "Auth-Password";

  static const String appQyUserTokenKey =
      '20250427114630-fdff3492-bbb5-44fb-8d91-398710446186';
  static const String appQyDebugKey =
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  static const String appQyUserBaseUrl = 'https://dictapi.si.12gm.com';
  static const String appQyStaticBaseUrl = 'http://127.0.0.1:8000';

  static const String appAchatUserBaseUrl = 'https://dictapi.si.12gm.com';
  static const String appAchatDebugKey =
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

  static const String appWuyUserBaseUrl = 'https://dictapi.si.12gm.com';
  static const String appWuyDebugKey =
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

  static const String appDevUserBaseUrl = 'https://dictapi.si.12gm.com';
  static const String appDevDebugKey =
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

  // Added for app_example
  static const String appExampleUserBaseUrl = 'https://dictapi.si.12gm.com';
  static const String appExampleDebugKey =
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

  static const String theme = 'theme';
  static const String deviceToken = 'deviceToken';
  static const String topic = 'notify';
  static const String zoneId = 'zoneId';

  static const int limitOfPickedIdentityImageNumber = 2;
  static const double limitOfPickedImageSizeInMB = 2;
  static const double completionArea = 500;
}
