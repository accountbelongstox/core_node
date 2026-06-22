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

// Word data structures
class WordItem {
  final String content;
  final String id;
  final String lastModified;
  final String usPhonetic;
  final String ukPhonetic;
  final dynamic translation;
  final dynamic voiceFiles;
  final dynamic imageFiles;

  WordItem({
    required this.content,
    required this.id,
    required this.lastModified,
    required this.usPhonetic,
    required this.ukPhonetic,
    required this.translation,
    required this.voiceFiles,
    required this.imageFiles,
  });

  factory WordItem.fromJson(Map<String, dynamic> json) {
    return WordItem(
      content: json['content'] ?? '',
      id: json['id'] ?? '',
      lastModified: json['lastModified'] ?? '',
      usPhonetic: json['usPhonetic'] ?? '',
      ukPhonetic: json['ukPhonetic'] ?? '',
      translation: json['translation'],
      voiceFiles: json['voice_files'],
      imageFiles: json['image_files'],
    );
  }
}

class WordTranslation {
  final List<String> wordTranslation;
  final List<String>? advancedTranslate;
  final String? advancedTranslateType;
  final String? pluralForm;
  final List<String>? synonyms;
  final String? synonymsType;

  WordTranslation({
    required this.wordTranslation,
    this.advancedTranslate,
    this.advancedTranslateType,
    this.pluralForm,
    this.synonyms,
    this.synonymsType,
  });

  factory WordTranslation.fromJson(Map<String, dynamic> json) {
    return WordTranslation(
      wordTranslation: List<String>.from(json['word_translation'] ?? []),
      advancedTranslate: json['advanced_translate'] != null
          ? List<String>.from(json['advanced_translate'])
          : null,
      advancedTranslateType: json['advanced_translate_type'],
      pluralForm: json['plural_form'],
      synonyms:
          json['synonyms'] != null ? List<String>.from(json['synonyms']) : null,
      synonymsType: json['synonyms_type'],
    );
  }
}
