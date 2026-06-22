import 'package:flutter/foundation.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/api_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/models_app_qy/vocabulary_models_app_qy.dart';

class VocabularyServiceAppQy extends ChangeNotifier {
  static final VocabularyServiceAppQy _instance = VocabularyServiceAppQy._internal();
  factory VocabularyServiceAppQy() => _instance;
  
  final ApiServiceAppQy _apiService;
  
  List<VocabularyCollectionModel> _collections = [];
  List<WordCardModel> _wordCards = [];
  List<SupportedLanguageModel> _supportedLanguages = [];
  LearningStatsModel _stats = LearningStatsModel();
  
  String _currentLangCode = 'en';
  bool _isLoading = false;
  String? _error;
  
  VocabularyServiceAppQy._internal() : _apiService = ApiServiceAppQy();
  
  List<VocabularyCollectionModel> get collections => _collections;
  List<WordCardModel> get wordCards => _wordCards;
  List<SupportedLanguageModel> get supportedLanguages => _supportedLanguages;
  LearningStatsModel get stats => _stats;
  String get currentLangCode => _currentLangCode;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  List<WordCardModel> get newWords => 
      _wordCards.where((w) => w.isNew).toList();
  
  List<WordCardModel> get learningWords => 
      _wordCards.where((w) => w.isLearning).toList();
  
  List<WordCardModel> get masteredWords => 
      _wordCards.where((w) => w.isMastered).toList();
  
  List<WordCardModel> get reviewDueWords => 
      _wordCards.where((w) => w.needsReview).toList();
  
  Future<void> initialize() async {
    await Future.wait([
      loadSupportedLanguages(),
      loadLearningStats(),
    ]);
  }
  
  Future<bool> loadSupportedLanguages() async {
    _setLoading(true);
    
    final response = await _apiService.getSupportedLanguages();
    
    if (response['success'] == true) {
      final data = response['data'];
      if (data is List) {
        _supportedLanguages = data
            .map((e) => SupportedLanguageModel.fromJson(e))
            .toList();
      } else if (data is Map<String, dynamic>) {
        _supportedLanguages = data.entries
            .map((e) => SupportedLanguageModel.fromEntry(e.key, e.value.toString()))
            .toList();
      }
      _setLoading(false);
      return true;
    }
    
    _setError(response['error']?.toString());
    _setLoading(false);
    return false;
  }
  
  Future<bool> loadVocabularyLibraries({String? langCode}) async {
    _setLoading(true);
    
    final response = await _apiService.getVocabularyLibraries(
      langCode: langCode ?? _currentLangCode,
    );
    
    if (response['success'] == true) {
      final data = response['data'];
      if (data is List) {
        _collections = data
            .map((e) => VocabularyCollectionModel.fromJson(e))
            .toList();
      }
      _setLoading(false);
      notifyListeners();
      return true;
    }
    
    _setError(response['error']?.toString());
    _setLoading(false);
    return false;
  }
  
  Future<bool> selectLibrary({
    required int collectionId,
    String action = 'add',
  }) async {
    _setLoading(true);
    
    final response = await _apiService.selectVocabularyLibrary(
      collectionId: collectionId,
      langCode: _currentLangCode,
      action: action,
    );
    
    if (response['success'] == true) {
      await loadVocabularyLibraries();
      _setLoading(false);
      return true;
    }
    
    _setError(response['error']?.toString());
    _setLoading(false);
    return false;
  }
  
  Future<bool> loadWordCards({int limit = 100}) async {
    _setLoading(true);
    
    final response = await _apiService.getWordCards(
      langCode: _currentLangCode,
      limit: limit,
    );
    
    if (response['success'] == true) {
      final data = response['data'];
      if (data is List) {
        _wordCards = data
            .map((e) => WordCardModel.fromJson(e))
            .toList();
      }
      _setLoading(false);
      notifyListeners();
      return true;
    }
    
    _setError(response['error']?.toString());
    _setLoading(false);
    return false;
  }
  
  Future<bool> updateProgress({
    required int progressId,
    required bool correct,
  }) async {
    final response = await _apiService.updateLearningProgress(
      progressId: progressId,
      correct: correct,
    );
    
    if (response['success'] == true) {
      await loadLearningStats();
      return true;
    }
    
    return false;
  }
  
  Future<bool> loadLearningStats({String? langCode}) async {
    final response = await _apiService.getLearningStats(
      langCode: langCode ?? _currentLangCode,
    );
    
    if (response['success'] == true) {
      _stats = LearningStatsModel.fromJson(response);
      notifyListeners();
      return true;
    }
    
    return false;
  }
  
  Future<String?> generateTts({
    required String text,
    String textType = 'word',
    String rate = '+0%',
  }) async {
    final response = await _apiService.generateTts(
      text: text,
      langCode: _currentLangCode,
      textType: textType,
      rate: rate,
    );
    
    if (response['success'] == true) {
      final audioPath = response['data']?['audio_path'] ?? response['audio_path'];
      if (audioPath != null) {
        return _apiService.getTtsAudioUrl(audioPath);
      }
    }
    
    return null;
  }
  
  void setCurrentLanguage(String langCode) {
    if (_currentLangCode != langCode) {
      _currentLangCode = langCode;
      _collections = [];
      _wordCards = [];
      notifyListeners();
      
      loadVocabularyLibraries();
      loadWordCards();
      loadLearningStats();
    }
  }
  
  void _setLoading(bool value) {
    _isLoading = value;
    _error = null;
    notifyListeners();
  }
  
  void _setError(String? message) {
    _error = message;
    notifyListeners();
  }
  
  void clearError() {
    _error = null;
    notifyListeners();
  }
}

