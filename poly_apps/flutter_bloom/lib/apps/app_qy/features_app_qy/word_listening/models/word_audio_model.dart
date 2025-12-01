/// Word audio data models
library;

class WordAudioItem {
  final String word;
  final String pronunciation;
  final String meaningKey; // Localization key for meaning
  final String exampleKey; // Localization key for example

  WordAudioItem({
    required this.word,
    required this.pronunciation,
    required this.meaningKey,
    required this.exampleKey,
  });
}

enum ListeningCategory {
  wordBook,
  newWords,
  todayNew,
  todayReview,
  fullList,
  fullUnlearned,
  fullLearning,
  fullSimple,
}

