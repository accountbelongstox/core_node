/// Category list widget for word listening
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class CategoryList extends StatelessWidget {
  const CategoryList({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      itemCount: 5,
      itemBuilder: (context, index) {
        return GlassCard(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: ColorsAppQy.qyPrimary.withOpacity(0.1),
              child: Icon(
                Icons.category,
                color: ColorsAppQy.qyPrimary,
                size: ThemeDimensions.iconSizeM,
              ),
            ),
            title: Text(
              'Category ${index + 1}',
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
                color: ColorsAppQy.qyTextPrimary,
              ),
            ),
            subtitle: Text(
              '${(index + 1) * 50} words',
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
            trailing: Icon(
              Icons.arrow_forward_ios,
              size: ThemeDimensions.iconSizeS,
              color: ColorsAppQy.qyTextSecondary,
            ),
            onTap: () {
              // Handle category tap
            },
          ),
          borderRadius: ThemeDimensions.borderRadiusM,
        );
      },
    );
  }
}
