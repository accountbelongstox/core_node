/// Word book data models
library word_models;

enum WordType { all, learning, newWords, mastered }

class WordItem {
  final String word;
  final String pronunciation;
  final String meaning;
  final String example;
  WordType type;
  double masteryLevel;

  WordItem({
    required this.word,
    required this.pronunciation,
    required this.meaning,
    required this.example,
    required this.type,
    required this.masteryLevel,
  });
}