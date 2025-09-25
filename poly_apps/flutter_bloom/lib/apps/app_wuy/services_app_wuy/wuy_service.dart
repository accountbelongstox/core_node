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

import '../config_app_wuy/api_data_models_app_wuy.dart';
import '../config_app_wuy/api_endpoints_app_wuy.dart';

/// Wuy Service
/// Main service class for Wuy app business logic operations
/// This service provides high-level business methods that use the API services
class WuyService {
  
  
  /// Validate content data before creation
  static bool validateContentData(CreateContentRequestDataWuy contentData) {
    if (contentData.title.trim().isEmpty) {
      return false;
    }
    
    if (contentData.title.length > 200) {
      return false;
    }
    
    if (contentData.description != null && contentData.description!.length > 1000) {
      return false;
    }
    
    return true;
  }
  
  /// Validate user update data
  static bool validateUserUpdateData(UpdateUserRequestDataWuy userData) {
    if (userData.firstName != null && userData.firstName!.length > 50) {
      return false;
    }
    
    if (userData.lastName != null && userData.lastName!.length > 50) {
      return false;
    }
    
    if (userData.phoneNumber != null) {
      final phoneRegex = RegExp(r'^\+?[1-9]\d{1,14}$');
      if (!phoneRegex.hasMatch(userData.phoneNumber!)) {
        return false;
      }
    }
    
    return true;
  }
  
  /// Format search query
  static String formatSearchQuery(String query) {
    return query.trim().toLowerCase();
  }
  
  /// Build search request with defaults
  static SearchRequestDataWuy buildSearchRequest({
    required String query,
    String? category,
    List<String>? tags,
    int page = 1,
    int limit = 20,
    String? sortBy = 'created_at',
    String? sortOrder = 'desc',
  }) {
    return SearchRequestDataWuy(
      query: formatSearchQuery(query),
      category: category,
      tags: tags,
      page: page,
      limit: limit,
      sortBy: sortBy,
      sortOrder: sortOrder,
    );
  }
  
  
  /// Validate file upload data
  static bool validateFileUpload(FileUploadRequestDataWuy fileData) {
    if (fileData.fileName.trim().isEmpty) {
      return false;
    }
    
    // Check file extension
    final allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt'];
    final hasValidExtension = allowedExtensions.any(
      (ext) => fileData.fileName.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      return false;
    }
    
    return true;
  }
  
  /// Get file type from filename
  static String getFileType(String fileName) {
    final extension = fileName.toLowerCase().split('.').last;
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'image';
      case 'pdf':
        return 'document';
      case 'doc':
      case 'docx':
        return 'document';
      case 'txt':
        return 'text';
      default:
        return 'unknown';
    }
  }
  
  
  /// Validate login credentials
  static bool validateLoginCredentials(String username, String password) {
    if (username.trim().isEmpty || password.trim().isEmpty) {
      return false;
    }
    
    if (username.length < 3 || username.length > 50) {
      return false;
    }
    
    if (password.length < 8) {
      return false;
    }
    
    return true;
  }
  
  /// Validate registration data
  static bool validateRegistrationData(RegisterRequestDataWuy regData) {
    // Validate email
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(regData.email)) {
      return false;
    }
    
    // Validate username
    if (regData.username.length < 3 || regData.username.length > 50) {
      return false;
    }
    
    // Validate password
    if (regData.password.length < 8) {
      return false;
    }
    
    // Check password strength
    final hasLetter = RegExp(r'[a-zA-Z]').hasMatch(regData.password);
    final hasNumber = RegExp(r'[0-9]').hasMatch(regData.password);
    
    if (!hasLetter || !hasNumber) {
      return false;
    }
    
    return true;
  }
  
  /// Generate user display name
  static String generateDisplayName(UserDataWuy user) {
    return user.displayName;
  }
  
  
  /// Format date for display
  static String formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);
    
    if (difference.inDays > 7) {
      return '${date.day}/${date.month}/${date.year}';
    } else if (difference.inDays > 0) {
      return '${difference.inDays} days ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours} hours ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes} minutes ago';
    } else {
      return 'Just now';
    }
  }
  
  /// Truncate text with ellipsis
  static String truncateText(String text, int maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return '${text.substring(0, maxLength)}...';
  }
  
  /// Generate content preview
  static String generateContentPreview(ContentDataWuy content, int maxLength) {
    final text = content.description ?? content.content ?? content.title;
    return truncateText(text, maxLength);
  }
  
  /// Check if content is recent
  static bool isRecentContent(ContentDataWuy content, {int daysThreshold = 7}) {
    final now = DateTime.now();
    final difference = now.difference(content.createdAt);
    return difference.inDays <= daysThreshold;
  }
  
  /// Get content status text
  static String getContentStatusText(ContentDataWuy content) {
    if (content.isPublished) {
      return 'Published';
    } else {
      return 'Draft';
    }
  }
  
  /// Build endpoint URL
  static String buildEndpointUrl(String endpoint, {Map<String, dynamic>? params}) {
    return ApiEndpointsAppWuy.buildEndpoint(endpoint, params);
  }
  
  /// Build paginated endpoint URL
  static String buildPaginatedEndpointUrl(
    String endpoint, {
    int page = 1,
    int limit = 20,
    Map<String, dynamic>? additionalParams,
  }) {
    return ApiEndpointsAppWuy.buildPaginatedEndpoint(
      endpoint,
      page: page,
      limit: limit,
      additionalParams: additionalParams,
    );
  }
}