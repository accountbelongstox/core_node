library;

import 'package:flutter/material.dart';
import '../../../../../../../common/theme/app_theme.dart';
import '../../../../../../../common/widgets/glassmorphism_card.dart';

class CurrentWordCard extends StatelessWidget {
  final String word;
  final String phonetic;
  final String translation;
  final String? example;

  const CurrentWordCard({
    super.key,
    required this.word,
    required this.phonetic,
    required this.translation,
    this.example,
  });

  @override
  Widget build(BuildContext context) {
    return GlassmorphismCard(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              word,
              style: const TextStyle(
                fontSize: 36,
                fontWeight: FontWeight.bold,
                color: AppTheme.primaryGreen,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              phonetic,
              style: const TextStyle(
                fontSize: 18,
                color: AppTheme.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              translation,
              style: const TextStyle(
                fontSize: 20,
                color: AppTheme.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            if (example != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.lightGreen.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  example!,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppTheme.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
