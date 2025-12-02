// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Word - Simplified model for word card feature
/// Uses centralized vocabulary models when available
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