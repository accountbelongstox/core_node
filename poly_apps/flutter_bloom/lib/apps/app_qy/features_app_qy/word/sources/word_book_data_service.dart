library;

import '../domain/model/word_model.dart';

class WordBookDataService {
  static List<WordBookModel> getMockWordBooks() {
    return [
      const WordBookModel(
        id: 'book_1',
        name: 'IELTS Core Vocabulary',
        description: 'Essential words for IELTS preparation.',
        totalWords: 3000,
        learnedWords: 450,
        remainingWords: 2550,
        coverUrl: null,
        category: 'ielts',
      ),
      const WordBookModel(
        id: 'book_2',
        name: 'Daily English',
        description: 'Common words for daily communication.',
        totalWords: 2000,
        learnedWords: 200,
        remainingWords: 1800,
        coverUrl: null,
        category: 'general',
      ),
    ];
  }

  static Map<String, dynamic> getDefaultWordBookInfo() {
    return {
      'id': 'default',
      'name': 'Default Word Book',
      'total_words': 0,
      'learned_words': 0,
      'remaining_words': 0,
    };
  }
}
