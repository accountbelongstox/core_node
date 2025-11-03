/// Feature grid widget showing all learning features
library feature_grid;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../word_book/views/word_book_screen.dart';
import '../../word_listening/views/word_listening_screen.dart';

class FeatureGrid extends StatelessWidget {
  const FeatureGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final features = [
      FeatureItem(
        icon: Icons.library_books,
        label: 'home.wordBook'.tr,
        color: const Color(0xFF66BB6A),
        gradient: const LinearGradient(
          colors: [Color(0xFF66BB6A), Color(0xFF81C784)],
        ),
        onTap: () => _navigateToWordBook(context),
      ),
      FeatureItem(
        icon: Icons.headphones,
        label: 'home.listening'.tr,
        color: const Color(0xFF42A5F5),
        gradient: const LinearGradient(
          colors: [Color(0xFF42A5F5), Color(0xFF64B5F6)],
        ),
        onTap: () => _navigateToWordListening(context),
      ),
      FeatureItem(
        icon: Icons.quiz,
        label: 'home.wordTest'.tr,
        color: const Color(0xFFFFCA28),
        gradient: const LinearGradient(
          colors: [Color(0xFFFFCA28), Color(0xFFFFD54F)],
        ),
      ),
      FeatureItem(
        icon: Icons.speed,
        label: 'home.quickBrush'.tr,
        color: const Color(0xFF26C6DA),
        gradient: const LinearGradient(
          colors: [Color(0xFF26C6DA), Color(0xFF4DD0E1)],
        ),
      ),
      FeatureItem(
        icon: Icons.article,
        label: 'home.shortStories'.tr,
        color: const Color(0xFFEF5350),
        gradient: const LinearGradient(
          colors: [Color(0xFFEF5350), Color(0xFFE57373)],
        ),
      ),
      FeatureItem(
        icon: Icons.mic,
        label: 'home.speaking'.tr,
        color: const Color(0xFFAB47BC),
        gradient: const LinearGradient(
          colors: [Color(0xFFAB47BC), Color(0xFFBA68C8)],
        ),
      ),
      FeatureItem(
        icon: Icons.book,
        label: 'home.reading'.tr,
        color: const Color(0xFF5C6BC0),
        gradient: const LinearGradient(
          colors: [Color(0xFF5C6BC0), Color(0xFF7986CB)],
        ),
      ),
      FeatureItem(
        icon: Icons.calendar_month,
        label: 'home.studyPlan'.tr,
        color: const Color(0xFF26A69A),
        gradient: const LinearGradient(
          colors: [Color(0xFF26A69A), Color(0xFF4DB6AC)],
        ),
      ),
      FeatureItem(
        icon: Icons.bar_chart,
        label: 'home.studyData'.tr,
        color: const Color(0xFFFF7043),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF7043), Color(0xFFFF8A65)],
        ),
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 1.0,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: features.length,
      itemBuilder: (context, index) {
        final feature = features[index];
        return _buildFeatureCard(context, feature);
      },
    );
  }

  Widget _buildFeatureCard(BuildContext context, FeatureItem feature) {
    return InkWell(
      onTap: feature.onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          gradient: feature.gradient,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: feature.color.withOpacity(0.3),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              feature.icon,
              color: Colors.white,
              size: 32,
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                feature.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToWordBook(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const WordBookScreen(),
      ),
    );
  }

  void _navigateToWordListening(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const WordListeningScreen(),
      ),
    );
  }
}

class FeatureItem {
  final IconData icon;
  final String label;
  final Color color;
  final Gradient gradient;
  final VoidCallback? onTap;

  FeatureItem({
    required this.icon,
    required this.label,
    required this.color,
    required this.gradient,
    this.onTap,
  });
}