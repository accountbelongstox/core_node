library;

import 'package:flutter/material.dart';
import '../../../../../../../common/theme/app_theme.dart';
import '../../models/word_models.dart';

class WordListView extends StatelessWidget {
  final String searchQuery;
  final WordType wordType;

  const WordListView({
    super.key,
    required this.searchQuery,
    required this.wordType,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 10,
      itemBuilder: (context, index) {
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: AppTheme.primaryGreen.withOpacity(0.1),
              child: Text(
                '${index + 1}',
                style: const TextStyle(
                  color: AppTheme.primaryGreen,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            title: Text(
              'Word ${index + 1}',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            subtitle: Text(
              'Definition for word ${index + 1}',
              style: const TextStyle(
                color: AppTheme.textSecondary,
              ),
            ),
            trailing: const Icon(
              Icons.arrow_forward_ios,
              size: 16,
              color: AppTheme.textSecondary,
            ),
            onTap: () {
              // Handle word tap
            },
          ),
        );
      },
    );
  }
}
