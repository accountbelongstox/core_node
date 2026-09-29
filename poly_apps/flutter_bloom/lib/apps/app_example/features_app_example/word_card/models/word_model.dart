class Word {
  final String word;
  final String phonetic;
  final String translation;
  final String example;
  final String? audioUrl;

  Word({
    required this.word,
    required this.phonetic,
    required this.translation,
    required this.example,
    this.audioUrl,
  });

  factory Word.fromJson(Map<String, dynamic> json) {
    return Word(
      word: json['word'] as String,
      phonetic: json['phonetic'] as String,
      translation: json['translation'] as String,
      example: json['example'] as String,
      audioUrl: json['audioUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'word': word,
      'phonetic': phonetic,
      'translation': translation,
      'example': example,
      'audioUrl': audioUrl,
    };
  }
} 