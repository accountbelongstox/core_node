import 'package:flutter/foundation.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/vocabulary_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/models_app_qy/vocabulary_models_app_qy.dart';

enum LearningMode {
  newWords,
  review,
  flashcard,
  dictation,
  listening,
}

class LearningControllerAppQy extends ChangeNotifier {
  final VocabularyServiceAppQy _vocabularyService;
  
  LearningMode _currentMode = LearningMode.newWords;
  int _currentIndex = 0;
  List<WordCardModel> _sessionWords = [];
  bool _showAnswer = false;
  int _sessionCorrect = 0;
  int _sessionWrong = 0;
  bool _isSessionActive = false;
  
  LearningControllerAppQy({
    VocabularyServiceAppQy? vocabularyService,
  }) : _vocabularyService = vocabularyService ?? VocabularyServiceAppQy();
  
  VocabularyServiceAppQy get vocabularyService => _vocabularyService;
  LearningMode get currentMode => _currentMode;
  int get currentIndex => _currentIndex;
  List<WordCardModel> get sessionWords => _sessionWords;
  bool get showAnswer => _showAnswer;
  int get sessionCorrect => _sessionCorrect;
  int get sessionWrong => _sessionWrong;
  bool get isSessionActive => _isSessionActive;
  
  WordCardModel? get currentWord => 
      _sessionWords.isNotEmpty && _currentIndex < _sessionWords.length 
          ? _sessionWords[_currentIndex] 
          : null;
  
  bool get hasNextWord => _currentIndex < _sessionWords.length - 1;
  bool get hasPreviousWord => _currentIndex > 0;
  
  int get totalWords => _sessionWords.length;
  int get completedWords => _currentIndex;
  double get progress => totalWords > 0 ? completedWords / totalWords : 0;
  double get accuracy => 
      (_sessionCorrect + _sessionWrong) > 0 
          ? _sessionCorrect / (_sessionCorrect + _sessionWrong) 
          : 0;
  
  Future<void> initialize() async {
    await _vocabularyService.initialize();
    notifyListeners();
  }
  
  Future<void> startSession({
    LearningMode mode = LearningMode.newWords,
    int? limit,
  }) async {
    _currentMode = mode;
    _currentIndex = 0;
    _showAnswer = false;
    _sessionCorrect = 0;
    _sessionWrong = 0;
    _isSessionActive = true;
    
    await _vocabularyService.loadWordCards(limit: limit ?? 20);
    
    switch (mode) {
      case LearningMode.newWords:
        _sessionWords = _vocabularyService.newWords.take(limit ?? 20).toList();
        break;
      case LearningMode.review:
        _sessionWords = _vocabularyService.reviewDueWords.take(limit ?? 20).toList();
        break;
      case LearningMode.flashcard:
      case LearningMode.dictation:
      case LearningMode.listening:
        _sessionWords = _vocabularyService.wordCards.take(limit ?? 20).toList();
        break;
    }
    
    if (_sessionWords.isEmpty) {
      _sessionWords = _vocabularyService.wordCards.take(limit ?? 20).toList();
    }
    
    notifyListeners();
  }
  
  void toggleAnswer() {
    _showAnswer = !_showAnswer;
    notifyListeners();
  }
  
  void revealAnswer() {
    _showAnswer = true;
    notifyListeners();
  }
  
  void hideAnswer() {
    _showAnswer = false;
    notifyListeners();
  }
  
  Future<void> markCorrect() async {
    _sessionCorrect++;
    
    if (currentWord != null) {
      await _vocabularyService.updateProgress(
        progressId: currentWord!.id,
        correct: true,
      );
    }
    
    _nextWord();
  }
  
  Future<void> markWrong() async {
    _sessionWrong++;
    
    if (currentWord != null) {
      await _vocabularyService.updateProgress(
        progressId: currentWord!.id,
        correct: false,
      );
    }
    
    _nextWord();
  }
  
  void _nextWord() {
    _showAnswer = false;
    if (_currentIndex < _sessionWords.length - 1) {
      _currentIndex++;
    } else {
      _isSessionActive = false;
    }
    notifyListeners();
  }
  
  void goToNext() {
    if (hasNextWord) {
      _currentIndex++;
      _showAnswer = false;
      notifyListeners();
    }
  }
  
  void goToPrevious() {
    if (hasPreviousWord) {
      _currentIndex--;
      _showAnswer = false;
      notifyListeners();
    }
  }
  
  void goToIndex(int index) {
    if (index >= 0 && index < _sessionWords.length) {
      _currentIndex = index;
      _showAnswer = false;
      notifyListeners();
    }
  }
  
  void endSession() {
    _isSessionActive = false;
    notifyListeners();
  }
  
  void resetSession() {
    _currentIndex = 0;
    _showAnswer = false;
    _sessionCorrect = 0;
    _sessionWrong = 0;
    _isSessionActive = true;
    notifyListeners();
  }
  
  Future<String?> playWordAudio() async {
    if (currentWord == null) return null;
    
    if (currentWord!.primaryTtsUrl != null) {
      return currentWord!.primaryTtsUrl;
    }
    
    return await _vocabularyService.generateTts(
      text: currentWord!.word,
      textType: 'word',
    );
  }
  
  void setLanguage(String langCode) {
    _vocabularyService.setCurrentLanguage(langCode);
    _sessionWords = [];
    _currentIndex = 0;
    notifyListeners();
  }
}

