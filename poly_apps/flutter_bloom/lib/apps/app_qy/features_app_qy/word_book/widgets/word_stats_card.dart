/// Word statistics card widget
library;

import 'package:flutter/material.dart';
import '../../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../../common/theme/app_theme.dart';

class WordStatsCard extends StatelessWidget {
  const WordStatsCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: ComponentStyles.primaryCardDecoration,
      child: Container(
        padding: const EdgeInsets.all(ComponentStyles.lg),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppTheme.primaryGreen.withOpacity(0.08),
              AppTheme.secondaryGreen.withOpacity(0.04),
              Colors.white.withOpacity(0.9),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(ComponentStyles.radiusXLarge),
          border: Border.all(
            color: AppTheme.primaryGreen.withOpacity(0.1),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: _buildStatItem(
                context,
                Icons.book_outlined,
                'wordBook.wordCount'.tr,
                '2,458',
                AppTheme.primaryGreen,
              ),
            ),
            Container(
              width: 1,
              height: 40,
              color: Colors.grey.shade300,
            ),
            Expanded(
              child: _buildStatItem(
                context,
                Icons.school_outlined,
                'wordBook.learningCount'.tr,
                '1,234',
                AppTheme.secondaryGreen,
              ),
            ),
            Container(
              width: 1,
              height: 40,
              color: Colors.grey.shade300,
            ),
            Expanded(
              child: _buildStatItem(
                context,
                Icons.add_circle_outline,
                'wordBook.newCount'.tr,
                '156',
                Colors.orange,
              ),
            ),
            Container(
              width: 1,
              height: 40,
              color: Colors.grey.shade300,
            ),
            Expanded(
              child: _buildStatItem(
                context,
                Icons.check_circle_outline,
                'wordBook.masteredCount'.tr,
                '1,068',
                AppTheme.accentGreen,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(
    BuildContext context,
    IconData icon,
    String label,
    String value,
    Color color,
  ) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(ComponentStyles.sm),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(ComponentStyles.radiusMedium),
          ),
          child: Icon(
            icon,
            color: color,
            size: 20,
          ),
        ),
        const SizedBox(height: ComponentStyles.sm),
        Text(
          value,
          style: AppTextStyles.headline4.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        const SizedBox(height: ComponentStyles.xs),
        Text(
          label,
          style: AppTextStyles.bodySmall.copyWith(
            color: AppTheme.textSecondary,
            fontSize: 10,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}