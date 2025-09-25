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

// Legacy import compatibility layer
// This file provides backward compatibility for old import paths

// Re-export all utilities with their old names for backward compatibility

// Date utilities (previously in lib/helper/)
export '../date/date_converter.dart';

// Email validation (previously in lib/helper/)
export '../validation/email_checker.dart';

// Image utilities (previously in lib/helper/)
export '../image/image_loader.dart';
export '../image/image_size_checker.dart';

// Display utilities (previously in lib/helper/)
export '../display/display_helper.dart';
export '../display/responsive_helper.dart';

// Platform utilities (previously in lib/util/)
export '../platform/get_platform.dart';

// Common utilities (previously in lib/helper/)
export '../common/price_converter.dart';
export '../common/toaster_helper.dart';


// Text utilities
export '../text/text_utils.dart';

// Deprecated aliases for backward compatibility
// Note: These typedefs have been removed as they were causing import conflicts
// Use the actual classes directly from their respective files
