library;

import 'package:flutter/material.dart';
import '../../../../../../../common/theme/app_theme.dart';
import '../../../../../../../common/widgets/glassmorphism_card.dart';

class WordStatsCard extends StatelessWidget {
  const WordStatsCard({super.key});

  @override
  Widget build(BuildContext context) {
    return GlassmorphismCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildStatItem(
              icon: Icons.book,
              label: 'Total',
              value: '1000',
              color: AppTheme.primaryGreen,
            ),
            _buildStatItem(
              icon: Icons.school,
              label: 'Learning',
              value: '350',
              color: AppTheme.secondaryGreen,
            ),
            _buildStatItem(
              icon: Icons.check_circle,
              label: 'Mastered',
              value: '650',
              color: AppTheme.lightGreen,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      children: [
        Icon(icon, color: color, size: 32),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: AppTheme.textSecondary,
          ),
        ),
      ],
    );
  }
}
