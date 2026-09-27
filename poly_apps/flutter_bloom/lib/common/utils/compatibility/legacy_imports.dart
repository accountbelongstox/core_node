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
