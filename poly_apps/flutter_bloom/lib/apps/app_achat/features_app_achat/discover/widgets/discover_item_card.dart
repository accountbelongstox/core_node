// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/models_app_achat/discover_item_model.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class DiscoverItemCard extends StatelessWidget {
  final DiscoverItemModel item;
  final VoidCallback? onTap;

  const DiscoverItemCard({
    super.key,
    required this.item,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
        child: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
          child: Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: _getIconColor(item.type),
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
                ),
                child: Icon(
                  _getIcon(item.type),
                  color: ThemeColors.white,
                  size: 32,
                ),
              ),
              SizedBox(width: ThemeDimensions.paddingSizeDefault),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: ThemeTextStyles.bodyLarge.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (item.isNew)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: ThemeDimensions.paddingSizeSmall,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: ThemeColors.error,
                              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                            ),
                            child: Text(
                              'NEW',
                              style: ThemeTextStyles.labelSmall.copyWith(
                                color: ThemeColors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        if (item.isPopular)
                          Container(
                            margin: EdgeInsets.only(left: item.isNew ? 4 : 0),
                            padding: const EdgeInsets.symmetric(
                              horizontal: ThemeDimensions.paddingSizeSmall,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: ThemeColors.warning,
                              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                            ),
                            child: Text(
                              'HOT',
                              style: ThemeTextStyles.labelSmall.copyWith(
                                color: ThemeColors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                      ],
                    ),
                    SizedBox(height: ThemeDimensions.spacing4),
                    Text(
                      item.description,
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: Theme.of(context).textTheme.bodySmall?.color,
                      ),
                    ),
                    if (item.userCount != null) ...[
                      SizedBox(height: ThemeDimensions.spacing4),
                      Text(
                        '${item.userCount} users',
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: Theme.of(context).textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios,
                color: Theme.of(context).unselectedWidgetColor,
                size: ThemeDimensions.iconSizeSmall,
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getIcon(DiscoverItemType type) {
    switch (type) {
      case DiscoverItemType.moments:
        return Icons.photo_camera;
      case DiscoverItemType.channels:
        return Icons.forum;
      case DiscoverItemType.games:
        return Icons.games;
      case DiscoverItemType.miniPrograms:
        return Icons.apps;
    }
  }

  Color _getIconColor(DiscoverItemType type) {
    switch (type) {
      case DiscoverItemType.moments:
        return ThemeColors.primary;
      case DiscoverItemType.channels:
        return ThemeColors.success;
      case DiscoverItemType.games:
        return ThemeColors.info;
      case DiscoverItemType.miniPrograms:
        return ThemeColors.warning;
    }
  }
}