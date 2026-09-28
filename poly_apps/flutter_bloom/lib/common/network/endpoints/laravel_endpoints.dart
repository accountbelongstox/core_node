import 'package:qyflutter/common/constants/app_constants.dart';

/// Unified Laravel API Endpoints Configuration
/// Combines guest (public) and authenticated endpoints in one place
class LaravelEndpoints {
  static const apiBase = '${AppConstants.appQyUserBaseUrl}/api';
  static const dictionaryPrefix = '$apiBase/dict/v1';

  /// Guest/Public Endpoints (no authentication required)
  static const String register = '$apiBase/register';
  static const String login = '$apiBase/login';
  static const String forgotPassword = '$apiBase/forgot-password';
  static const String resetPassword = '$apiBase/reset-password';
  static const String verifyEmail = '$apiBase/verify-email/{id}/{hash}';
  static const String emailVerificationNotification = '$apiBase/email/verification-notification';
  static const String systemStatus = '$apiBase/get_system_status';

  /// Authenticated Endpoints (authentication required)
  static const String logout = '$apiBase/logout';
  static const String user = '$apiBase/user';

  /// Dictionary API Endpoints (authenticated)
  static const String createGroup = '$dictionaryPrefix/create_group';
  static const String queryAllGroups = '$dictionaryPrefix/query_all_groups';
  static const String queryGroupByName = '$dictionaryPrefix/query_group_by_name';
  static const String queryGroupByGid = '$dictionaryPrefix/query_group_by_gid';
  static const String queryGwords = '$dictionaryPrefix/query_gwords';
  static const String queryGcontent = '$dictionaryPrefix/query_gcontent';
  static const String queryGFrequency = '$dictionaryPrefix/query_gfrequency';
  static const String deleteGroupByName = '$dictionaryPrefix/delete_group_by_name';
  static const String deleteGroupByGid = '$dictionaryPrefix/delete_group_by_gid';
  static const String createPersonalDictionary = '$dictionaryPrefix/create_personal_dictionary';
  static const String queryPersonalDictionary = '$dictionaryPrefix/query_personal_dictionary';
  static const String queryPersonalDictionaryByWords = '$dictionaryPrefix/query_personal_dictionary_by_words';
  static const String deletePersonalDictionaryById = '$dictionaryPrefix/delete_personal_dictionary_by_id';
  static const String deletePersonalAllDictionary = '$dictionaryPrefix/delete_personal_all_dictionary';
  static const String queryWords = '$dictionaryPrefix/query_words';
  static const String upLearned = '$dictionaryPrefix/up_learned';
  static const String upRead = '$dictionaryPrefix/up_read';
  static const String upWeight = '$dictionaryPrefix/up_weight';
  static const String upReviewed = '$dictionaryPrefix/up_reviewed';
  static const String getAllGroupsByManager = '$dictionaryPrefix/get_all_groups_by_manager';
  static const String createGroupAndFetchList = '$dictionaryPrefix/create_group_and_fetch_list';
  static const String getGvars = '$dictionaryPrefix/get_gvars';

  /// Endpoint categories for easier management
  static const List<String> guestEndpoints = [
    register,
    login,
    forgotPassword,
    resetPassword,
    verifyEmail,
    emailVerificationNotification,
    systemStatus,
  ];

  static const List<String> authEndpoints = [
    logout,
    user,
  ];

  static const List<String> dictionaryEndpoints = [
    createGroup,
    queryAllGroups,
    queryGroupByName,
    queryGroupByGid,
    queryGwords,
    queryGcontent,
    queryGFrequency,
    deleteGroupByName,
    deleteGroupByGid,
    createPersonalDictionary,
    queryPersonalDictionary,
    queryPersonalDictionaryByWords,
    deletePersonalDictionaryById,
    deletePersonalAllDictionary,
    queryWords,
    upLearned,
    upRead,
    upWeight,
    upReviewed,
    getAllGroupsByManager,
    createGroupAndFetchList,
    getGvars,
  ];

  /// Helper method to check if endpoint requires authentication
  static bool requiresAuth(String endpoint) {
    return !guestEndpoints.contains(endpoint);
  }

  /// Helper method to get base URL for different endpoint types
  static String getBaseUrl() => apiBase;
  static String getDictionaryBaseUrl() => dictionaryPrefix;
}