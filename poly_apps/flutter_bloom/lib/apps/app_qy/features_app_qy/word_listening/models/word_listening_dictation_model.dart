/// Word Listening Dictation Model
/// Centralized model for dictation word data
library;

import 'package:flutter/material.dart';

class WordListeningDictationModel {
  final String word;
  final String phonetic;
  final String meaningKey; // Localization key instead of hardcoded text
  final String difficulty;
  final String category;
  final List<String> examples;
  final String audioSpeed;
  final String? context;

  WordListeningDictationModel({
    required this.word,
    required this.phonetic,
    required this.meaningKey,
    required this.difficulty,
    required this.category,
    required this.examples,
    required this.audioSpeed,
    this.context,
  });

  factory WordListeningDictationModel.fromJson(Map<String, dynamic> json) {
    return WordListeningDictationModel(
      word: json['word'] as String,
      phonetic: json['phonetic'] as String,
      meaningKey: json['meaningKey'] as String,
      difficulty: json['difficulty'] as String,
      category: json['category'] as String,
      examples: (json['examples'] as List).cast<String>(),
      audioSpeed: json['audioSpeed'] as String,
      context: json['context'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'word': word,
      'phonetic': phonetic,
      'meaningKey': meaningKey,
      'difficulty': difficulty,
      'category': category,
      'examples': examples,
      'audioSpeed': audioSpeed,
      'context': context,
    };
  }
}

class DictationLevelModel {
  final String titleKey; // Localization key for title
  final String subtitleKey; // Localization key for subtitle
  final String level;
  final IconData icon;
  final Color color;
  final int wordCount;
  final double progress;
  final bool locked;

  DictationLevelModel({
    required this.titleKey,
    required this.subtitleKey,
    required this.level,
    required this.icon,
    required this.color,
    required this.wordCount,
    required this.progress,
    required this.locked,
  });
}

