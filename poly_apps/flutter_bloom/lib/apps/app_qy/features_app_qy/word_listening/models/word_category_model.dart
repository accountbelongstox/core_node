/// Word category data models
library;

import 'package:flutter/material.dart';

class WordCategoryModel {
  final String titleKey;
  final String subtitleKey;
  final IconData icon;
  final Color color;
  final int count;
  final bool locked;

  const WordCategoryModel({
    required this.titleKey,
    required this.subtitleKey,
    required this.icon,
    required this.color,
    required this.count,
    required this.locked,
  });
}

class WordSleepCategoryModel {
  final String nameKey;

  const WordSleepCategoryModel({
    required this.nameKey,
  });
}

