class ApiEndpointsAppQy {
  
  static const String authLogin = '/api/dict/v1/login';
  static const String authRegister = '/api/dict/v1/register';
  static const String authLogout = '/api/dict/v1/logout';
  static const String authRefresh = '/api/dict/v1/refresh';
  static const String authSendCode = '/api/dict/v1/send-sms-code';
  static const String authVerifyCode = '/api/dict/v1/verify-sms-code';
  static const String authGetCurrentUser = '/api/dict/v1/user';
  
  static const String userProfile = '/api/dict/v1/user';
  static const String userLanguages = '/api/dict/v1/learning/languages';
  static const String userSetLanguages = '/api/dict/v1/learning/languages';
  static const String userStats = '/api/dict/v1/learning/stats';
  
  static const String vocabularyLibraries = '/api/dict/v1/learning/libraries';
  static const String vocabularySelect = '/api/dict/v1/learning/libraries/select';
  static const String vocabularyWords = '/api/dict/v1/learning/words';
  static const String vocabularyProgress = '/api/dict/v1/learning/progress';
  static const String vocabularyRecommendations = '/api/dict/v1/learning/recommendations';
  static const String vocabularyCollectionSelect = '/api/dict/v1/learning/collections/select';
  static const String vocabularyCollectionSelected = '/api/dict/v1/learning/collections/selected';
  
  static const String publicLibraries = '/api/dict/v1/public/vocabulary-collections';
  static const String publicWords = '/api/dict/v1/public/words';
  
  static const String ttsGenerate = '/api/app_qy_v1/ai_tools/tts/generate';
  static const String ttsAudio = '/api/app_qy_v1/ai_tools/tts/audio';
  static const String ttsBatch = '/api/app_qy_v1/ai_tools/tts/batch';
  static const String ttsVoices = '/api/app_qy_v1/ai_tools/tts/voices';
  
  static const String translateText = '/api/app_qy_v1/ai_tools/translate';
  static const String translateBatch = '/api/app_qy_v1/ai_tools/translate/batch';
  
  static const String systemLanguages = '/api/dict/v1/system/supported-languages';
  static const String systemLanguageByCode = '/api/dict/v1/system/supported-languages/{code}';
  static const String systemInit = '/api/dict/v1/system/initialize';
  static const String systemPreValidate = '/api/dict/v1/system/pre-validate';
  
  static const String wordGroupList = '/api/dict/v1/word-groups';
  static const String wordGroupCreate = '/api/dict/v1/word-groups/create';
  static const String wordGroupDelete = '/api/dict/v1/word-groups/delete';
  static const String wordGroupWords = '/api/dict/v1/word-groups/{id}/words';
  
  static const String dictionaryQuery = '/api/dict/v1/dictionary/query';
  static const String dictionaryBatch = '/api/dict/v1/dictionary/batch';
  static const String dictionarySearch = '/api/dict/v1/dictionary/search';
}

class ApiEndpointMethods {
  static const Map<String, String> methods = {
    ApiEndpointsAppQy.authLogin: 'POST',
    ApiEndpointsAppQy.authRegister: 'POST',
    ApiEndpointsAppQy.authLogout: 'POST',
    ApiEndpointsAppQy.authRefresh: 'POST',
    ApiEndpointsAppQy.authSendCode: 'POST',
    ApiEndpointsAppQy.authVerifyCode: 'POST',
    ApiEndpointsAppQy.userProfile: 'GET',
    ApiEndpointsAppQy.userLanguages: 'GET',
    ApiEndpointsAppQy.userSetLanguages: 'POST',
    ApiEndpointsAppQy.userStats: 'GET',
    ApiEndpointsAppQy.vocabularyLibraries: 'GET',
    ApiEndpointsAppQy.vocabularySelect: 'POST',
    ApiEndpointsAppQy.vocabularyWords: 'GET',
    ApiEndpointsAppQy.vocabularyProgress: 'POST',
    ApiEndpointsAppQy.publicLibraries: 'GET',
    ApiEndpointsAppQy.publicWords: 'GET',
    ApiEndpointsAppQy.ttsGenerate: 'POST',
    ApiEndpointsAppQy.ttsAudio: 'GET',
    ApiEndpointsAppQy.ttsBatch: 'POST',
    ApiEndpointsAppQy.ttsVoices: 'GET',
    ApiEndpointsAppQy.translateText: 'POST',
    ApiEndpointsAppQy.translateBatch: 'POST',
    ApiEndpointsAppQy.systemLanguages: 'GET',
    ApiEndpointsAppQy.systemInit: 'POST',
    ApiEndpointsAppQy.systemPreValidate: 'POST',
    ApiEndpointsAppQy.wordGroupList: 'GET',
    ApiEndpointsAppQy.wordGroupCreate: 'POST',
    ApiEndpointsAppQy.wordGroupDelete: 'DELETE',
    ApiEndpointsAppQy.wordGroupWords: 'GET',
    ApiEndpointsAppQy.dictionaryQuery: 'GET',
    ApiEndpointsAppQy.dictionaryBatch: 'POST',
    ApiEndpointsAppQy.dictionarySearch: 'GET',
  };
}
