library;

import 'package:flutter/material.dart';
import '../../../../../../../common/theme/app_theme.dart';

class CategoryList extends StatelessWidget {
  const CategoryList({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 5,
      itemBuilder: (context, index) {
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: AppTheme.primaryGreen.withOpacity(0.1),
              child: Icon(
                Icons.category,
                color: AppTheme.primaryGreen,
              ),
            ),
            title: Text(
              'Category ${index + 1}',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            subtitle: Text(
              '${(index + 1) * 50} words',
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
              // Handle category tap
            },
          ),
        );
      },
    );
  }
}
