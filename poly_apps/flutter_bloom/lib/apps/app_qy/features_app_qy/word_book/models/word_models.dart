/// Word book data models
library;

enum WordType { all, learning, newWords, mastered }

class WordItem {
  final String id;
  final String word;
  final String pronunciation;
  final String meaningKey;
  final String exampleKey;
  WordType type;
  double masteryLevel;

  WordItem({
    required this.id,
    required this.word,
    required this.pronunciation,
    required this.meaningKey,
    required this.exampleKey,
    required this.type,
    required this.masteryLevel,
  });
}