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

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/top_menu/widgets/custom_icon_label.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/top_menu/widgets/custom_icon_label_group.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';

class TopDropdownMenu extends StatelessWidget {
  final VoidCallback onClose;

  const TopDropdownMenu({
    super.key,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyMenu.tr(context),
                style: theme.textTheme.titleLarge,
              ),
              IconButton(
                icon: Icon(Icons.close, color: theme.colorScheme.onSurface),
                onPressed: onClose,
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                CustomIconLabelGroup(
                  iconLabelList: [
                    CustomIconLabel(
                      icon: Icons.school,
                      label: 'learning.ai_tutor'.tr(context),
                      iconColor: const Color(0xFF4CAF50),
                      color: const Color(0xFF4CAF50),
                      backgroundColor: const Color(0xFFFFF8E1),
                      onTap: () => _showFeatureDialog(
                          context, 'learning.ai_tutor'.tr(context)),
                    ),
                    CustomIconLabel(
                      icon: Icons.refresh,
                      label: 'learning.smart_review'.tr(context),
                      iconColor: const Color(0xFF2196F3),
                      color: const Color(0xFF2196F3),
                      backgroundColor: const Color(0xFFFFF8E1),
                      onTap: () => _showFeatureDialog(
                          context, 'learning.smart_review'.tr(context)),
                    ),
                    CustomIconLabel(
                      icon: Icons.headphones,
                      label: 'learning.podcast_listening'.tr(context),
                      iconColor: const Color(0xFFE91E63),
                      color: const Color(0xFFE91E63),
                      backgroundColor: const Color(0xFFFFF8E1),
                      onTap: () => _showFeatureDialog(
                          context, 'learning.podcast_listening'.tr(context)),
                    ),
                    CustomIconLabel(
                      icon: Icons.article,
                      label: 'learning.news_reading'.tr(context),
                      iconColor: const Color(0xFF9C27B0),
                      color: const Color(0xFF9C27B0),
                      backgroundColor: const Color(0xFFFFF8E1),
                      onTap: () => _showFeatureDialog(
                          context, 'learning.news_reading'.tr(context)),
                    ),
                    CustomIconLabel(
                      icon: Icons.note_add,
                      label: 'learning.word_memorization'.tr(context),
                      iconColor: const Color(0xFF00BCD4),
                      color: const Color(0xFF00BCD4),
                      backgroundColor: const Color(0xFFFFF8E1),
                      onTap: () => _showFeatureDialog(
                          context, 'learning.word_memorization'.tr(context)),
                    ),
                    CustomIconLabel(
                      icon: Icons.quiz,
                      label: 'learning.ai_quiz'.tr(context),
                      iconColor: const Color(0xFFFF9800),
                      color: const Color(0xFFFF9800),
                      backgroundColor: const Color(0xFFFFF8E1),
                      onTap: () => _showFeatureDialog(
                          context, 'learning.ai_quiz'.tr(context)),
                    ),
                    CustomIconLabel(
                      icon: Icons.mic,
                      label: 'learning.pronunciation_assessment'.tr(context),
                      iconColor: const Color(0xFF795548),
                      color: const Color(0xFF795548),
                      backgroundColor: const Color(0xFFFFF8E1),
                      onTap: () => _showFeatureDialog(context,
                          'learning.pronunciation_assessment'.tr(context)),
                    ),
                    CustomIconLabel(
                      icon: Icons.recommend,
                      label: 'learning.personalized_recommendation'.tr(context),
                      iconColor: const Color(0xFF607D8B),
                      color: const Color(0xFF607D8B),
                      backgroundColor: const Color(0xFFFFF8E1),
                      onTap: () => _showFeatureDialog(context,
                          'learning.personalized_recommendation'.tr(context)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showFeatureDialog(BuildContext context, String featureName) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qyIAm.tr(context)),
        content: Text('$featureName ${QyAppLocalizationKeys.qyFeature.tr(context)}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(QyAppLocalizationKeys.qyClose.tr(context)),
          ),
        ],
      ),
    );
  }
}
