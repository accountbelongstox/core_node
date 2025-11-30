import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/article_model_app_vipclub.dart';

class VipClubArticleCard extends StatelessWidget {
  final VipClubArticleModel article;
  final VoidCallback onTap;

  const VipClubArticleCard({
    super.key,
    required this.article,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 300,
        margin: EdgeInsets.only(right: ThemeDimensions.defaultPadding),
        decoration: BoxDecoration(
          color: ThemeColors.neutralWhite,
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.neutralBlack.withOpacity(0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (article.coverImageUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(ThemeDimensions.defaultRadius),
                  topRight: Radius.circular(ThemeDimensions.defaultRadius),
                ),
                child: Image.network(
                  article.coverImageUrl,
                  height: 150,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 150,
                      color: ThemeColors.neutralLightGrey,
                      child: const Icon(
                        Icons.article,
                        size: 48,
                        color: ThemeColors.neutralGrey,
                      ),
                    );
                  },
                ),
              ),
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    article.title,
                    style: ThemeTextStyles.headingSmall.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: ThemeDimensions.smallPadding),
                  Text(
                    article.summary,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ThemeColors.neutralDarkGrey,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Row(
                    children: [
                      Icon(
                        Icons.access_time,
                        size: 14,
                        color: ThemeColors.neutralGrey,
                      ),
                      SizedBox(width: ThemeDimensions.tinyPadding),
                      Text(
                        _formatDate(article.publishDate),
                        style: ThemeTextStyles.caption2.copyWith(
                          color: ThemeColors.neutralGrey,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays > 30) {
      return '${date.month}/${date.day}/${date.year}';
    } else if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else {
      return 'Just now';
    }
  }
}
