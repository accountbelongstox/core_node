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

/// Word controller for QY App - manages word state
library;

import 'package:flutter/material.dart';
import '../domain/model/word_model.dart';
import '../domain/service/word_service.dart';

class WordControllerAppQy extends ChangeNotifier {
  final WordService _wordService;
  List<WordBookModel> _wordBooks;
  WordBookModel? _currentWordBook;
  List<WordModel> _words;
  bool _isLoading;
  String? _errorMessage;
  int _searchOption; // 0: general search, 1: book search

  WordControllerAppQy({
    required WordService wordService,
  })  : _wordService = wordService,
        _wordBooks = [],
        _words = [],
        _isLoading = false,
        _searchOption = 0;

  List<WordBookModel> get wordBooks => _wordBooks;
  WordBookModel? get currentWordBook => _currentWordBook;
  List<WordModel> get words => _words;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  int get searchOption => _searchOption;

  void setSearchOption(int option) {
    _searchOption = option;
    notifyListeners();
  }

  Future<void> loadWordBooks() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _wordBooks = await _wordService.getWordBooks();
      if (_wordBooks.isNotEmpty) {
        _currentWordBook = _wordBooks.first;
      }
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> selectWordBook(String bookId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _currentWordBook = await _wordService.getWordBookById(bookId);
      await loadWordsByBook(bookId);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadWordsByBook(String bookId, {int page = 1}) async {
    try {
      _words = await _wordService.getWordsByBook(bookId, page: page);
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> searchWords(String query) async {
    if (query.trim().isEmpty) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _wordService.searchWords(query);
      // Handle search results
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> toggleFavorite(String wordId) async {
    try {
      await _wordService.toggleFavorite(wordId);
      // Update local state
      final index = _words.indexWhere((w) => w.id == wordId);
      if (index != -1) {
        _words[index] = _words[index].copyWith(
          isFavorite: !_words[index].isFavorite,
        );
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    super.dispose();
  }
}
