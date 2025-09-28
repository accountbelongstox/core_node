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

import 'package:qyflutter/common/constants/app_constants.dart';

const laravelApiBase = '${AppConstants.appQyUserBaseUrl}/api';
const laravelPrefix = '$laravelApiBase/dict/v1';

class LaravelAuthApis {
  static const laravelLogoutApi = '$laravelApiBase/logout';
  static const laravelUserApi = '$laravelApiBase/user';
// ------------------Dictionary API------------------
  static const laravelCreateGroupApi = '$laravelPrefix/create_group';
  static const laravelQueryAllGroupsApi = '$laravelPrefix/query_all_groups';
  static const laravelQueryGroupByNameApi =
      '$laravelPrefix/query_group_by_name';
  static const laravelQueryGroupByGidApi = '$laravelPrefix/query_group_by_gid';
  static const laravelQueryGwordsApi = '$laravelPrefix/query_gwords';
  static const laravelQueryGcontentApi = '$laravelPrefix/query_gcontent';
  static const laravelQueryGFrequencyApi = '$laravelPrefix/query_gfrequency';
  static const laravelDeleteGroupByNameApi =
      '$laravelPrefix/delete_group_by_name';
  static const laravelDeleteGroupByGidApi =
      '$laravelPrefix/delete_group_by_gid';
  static const laravelCreatePersonalDictionaryApi =
      '$laravelPrefix/create_personal_dictionary';
  static const laravelQueryPersonalDictionaryApi =
      '$laravelPrefix/query_personal_dictionary';
  static const laravelQueryPersonalDictionaryByWordsApi =
      '$laravelPrefix/query_personal_dictionary_by_words';
  static const laravelDeletePersonalDictionaryByIDApi =
      '$laravelPrefix/delete_personal_dictionary_by_id';
  static const laravelDeletePersonalAllDictionaryApi =
      '$laravelPrefix/delete_personal_all_dictionary';
  static const laravelQueryWordsApi = '$laravelPrefix/query_words';
  static const laravelUpLearnedApi = '$laravelPrefix/up_learned';
  static const laravelUpReadApi = '$laravelPrefix/up_read';
  static const laravelUpWeightApi = '$laravelPrefix/up_weight';
  static const laravelUpReviewedApi = '$laravelPrefix/up_reviewed';
  static const laravelGetAllGroupByManagerApi =
      '$laravelPrefix/get_all_groups_by_manager';
  static const laravelCreateGroupAndFetchListApi =
      '$laravelPrefix/create_group_and_fetch_list';
  static const laravelGetGvarsApi = '$laravelPrefix/get_gvars';
  static const laravelResetPasswordApi = '$laravelApiBase/reset-password';
}
