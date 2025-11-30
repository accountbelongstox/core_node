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

// AI: Claude Code - Navigation widgets index for easy access
// Reason: Provides single import point for all enhanced navigation widgets
// Exports both legacy and enhanced widgets for backward compatibility

// Enhanced Navigation Widgets
export 'enhanced_bottom_navigation.dart';
export 'action_bar.dart';
export 'back_app_bar.dart';

// Legacy Widgets (maintained for compatibility)
export 'custom_app_bar.dart';
export 'custom_bottom_navigation.dart';