/// Course lesson category model
library;

import 'package:flutter/material.dart';

class CourseLessonCategoryModel {
  final String titleKey;
  final IconData icon;
  final Color color;
  final int lessons;
  final int completed;

  const CourseLessonCategoryModel({
    required this.titleKey,
    required this.icon,
    required this.color,
    required this.lessons,
    required this.completed,
  });
}

class CoursePracticeModel {
  final String titleKey;
  final String subtitleKey;
  final IconData icon;
  final Color color;
  final String durationKey;
  final String type;

  const CoursePracticeModel({
    required this.titleKey,
    required this.subtitleKey,
    required this.icon,
    required this.color,
    required this.durationKey,
    required this.type,
  });
}

class CourseAchievementModel {
  final String titleKey;
  final IconData icon;
  final bool achieved;

  const CourseAchievementModel({
    required this.titleKey,
    required this.icon,
    required this.achieved,
  });
}

class CourseStatModel {
  final String titleKey;
  final String value;
  final IconData icon;
  final Color color;

  const CourseStatModel({
    required this.titleKey,
    required this.value,
    required this.icon,
    required this.color,
  });
}

