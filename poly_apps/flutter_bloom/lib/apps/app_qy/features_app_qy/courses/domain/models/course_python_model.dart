/// Python course data models
library;

import 'package:flutter/material.dart';

class PythonModuleModel {
  final String titleKey;
  final String subtitleKey;
  final IconData icon;
  final Color color;
  final int lessons;
  final int completed;
  final String durationKey;

  const PythonModuleModel({
    required this.titleKey,
    required this.subtitleKey,
    required this.icon,
    required this.color,
    required this.lessons,
    required this.completed,
    required this.durationKey,
  });
}

class PythonProjectModel {
  final String titleKey;
  final String? subtitleKey;
  final String difficultyKey;
  final IconData icon;
  final Color color;
  final String status;

  const PythonProjectModel({
    required this.titleKey,
    this.subtitleKey,
    required this.difficultyKey,
    required this.icon,
    required this.color,
    required this.status,
  });
}

class PythonSkillModel {
  final String nameKey;
  final double progress;
  final Color color;

  const PythonSkillModel({
    required this.nameKey,
    required this.progress,
    required this.color,
  });
}

