class ApiEndpointsAppQy {
  
  static const String authLogin = '/api/dict/v1/login';
  static const String authRegister = '/api/dict/v1/register';
  static const String authLogout = '/api/dict/v1/logout';
  static const String authRefresh = '/api/dict/v1/refresh';
  static const String authSendCode = '/api/dict/v1/send-sms-code';
  static const String authVerifyCode = '/api/dict/v1/verify-sms-code';
  static const String authGetCurrentUser = '/api/dict/v1/user';
  
  static const String userProfile = '/api/dict/v1/user';
  static const String userGetLanguages = '/api/dict/v1/learning/languages';
  static const String userSetLanguages = '/api/dict/v1/learning/languages/set';
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
  
  // User Initialization
  static const String userInitializationStatus = '/api/dict/v1/user/initialization-status';
  static const String userInitialize = '/api/dict/v1/user/initialize';
  static const String userProfileUpdate = '/api/dict/v1/user/profile';
  
  // Memory Bank
  static const String memoryBank = '/api/dict/v1/memory/bank';
  static const String memoryBankLibrary = '/api/dict/v1/memory/bank/library';
  static const String memoryBankUploadFile = '/api/dict/v1/memory/bank/upload-file';
  static const String memoryBankUploadText = '/api/dict/v1/memory/bank/upload-text';
  static const String memoryBankStatus = '/api/dict/v1/memory/bank/status';
  static const String memoryBankWordStatus = '/api/dict/v1/memory/bank/word';
  
  // Vocabulary Libraries (Public)
  static const String vocabularyLibrariesRecommended = '/api/dict/v1/vocabulary/libraries/recommended';
  static const String vocabularyLibrariesAll = '/api/dict/v1/vocabulary/libraries';
  
  // Reading Materials
  static const String readingDailyRecommended = '/api/dict/v1/reading/daily/recommended';
  static const String readingDailyAll = '/api/dict/v1/reading/daily';
  static const String readingBooksRecommended = '/api/dict/v1/reading/books/recommended';
  static const String readingBooksAll = '/api/dict/v1/reading/books';
  static const String readingArticle = '/api/dict/v1/reading/article';
  static const String readingBook = '/api/dict/v1/reading/book';
  static const String readingBookChapter = '/api/dict/v1/reading/book';
  
  // AI Features
  static const String aiUsageLimit = '/api/app_qy_v1/ai/usage-limit';
  static const String aiWordExplanation = '/api/app_qy_v1/ai/word-explanation';
  static const String aiLearningAssistant = '/api/app_qy_v1/ai/learning-assistant';
  
  // Word Search (Public)
  static const String wordPublicLookup = '/api/words/public';
  
  // Enhanced Word Query
  static const String wordEnhanced = '/api/dict/v1/word';
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
    ApiEndpointsAppQy.userGetLanguages: 'GET',
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
