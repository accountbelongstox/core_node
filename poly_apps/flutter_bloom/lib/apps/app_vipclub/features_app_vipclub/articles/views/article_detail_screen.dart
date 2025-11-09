import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/widgets.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/article_model_app_vipclub.dart';

/// Article Detail Screen
class VipClubArticleDetailScreen extends StatefulWidget {
  final VipClubArticleModel article;

  const VipClubArticleDetailScreen({
    super.key,
    required this.article,
  });

  @override
  State<VipClubArticleDetailScreen> createState() =>
      _VipClubArticleDetailScreenState();
}

class _VipClubArticleDetailScreenState
    extends State<VipClubArticleDetailScreen> {
  bool _isBookmarked = false;

  void _toggleBookmark() {
    setState(() => _isBookmarked = !_isBookmarked);

    showCustomSnackbar(
      context: context,
      message: _isBookmarked ? 'Article bookmarked' : 'Bookmark removed',
      type: SnackbarType.success,
    );
  }

  void _shareArticle() {
    showCustomSnackbar(
      context: context,
      message: 'Share functionality coming soon',
      type: SnackbarType.info,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.neutralWhite,
      body: CustomScrollView(
        slivers: [
          // App Bar with Cover Image
          SliverAppBar(
            expandedHeight: 250,
            pinned: true,
            backgroundColor: ThemeColors.primaryBlue,
            foregroundColor: ThemeColors.neutralWhite,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // Cover Image
                  widget.article.coverImageUrl.isNotEmpty
                      ? Image.network(
                          widget.article.coverImageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              color: ThemeColors.neutralGrey.withOpacity(0.2),
                              child: Icon(
                                Icons.article,
                                size: 80,
                                color: ThemeColors.neutralGrey,
                              ),
                            );
                          },
                        )
                      : Container(
                          color: ThemeColors.neutralGrey.withOpacity(0.2),
                          child: Icon(
                            Icons.article,
                            size: 80,
                            color: ThemeColors.neutralGrey,
                          ),
                        ),

                  // Gradient Overlay
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withOpacity(0.7),
                        ],
                      ),
                    ),
                  ),

                  // Category Badge
                  if (widget.article.isFeatured)
                    Positioned(
                      top: 60,
                      left: 16,
                      child: VipBadge(
                        tier: 'gold',
                        text: 'Featured',
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              IconActionButton(
                icon: _isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                onPressed: _toggleBookmark,
                backgroundColor: ThemeColors.primaryBlue.withOpacity(0.8),
                tooltip: 'Bookmark',
              ),
              SizedBox(width: ThemeDimensions.smallPadding),
              IconActionButton(
                icon: Icons.share,
                onPressed: _shareArticle,
                backgroundColor: ThemeColors.primaryBlue.withOpacity(0.8),
                tooltip: 'Share',
              ),
              SizedBox(width: ThemeDimensions.defaultPadding),
            ],
          ),

          // Content
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Category
                  StatusBadge(
                    text: widget.article.categoryDisplay,
                    backgroundColor: ThemeColors.primaryBlue,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),

                  // Title
                  Text(
                    widget.article.title,
                    style: ThemeTextStyles.headlineLarge.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),

                  // Meta Information
                  Row(
                    children: [
                      Icon(
                        Icons.person_outline,
                        size: 16,
                        color: ThemeColors.neutralGrey,
                      ),
                      SizedBox(width: ThemeDimensions.tinyPadding),
                      Text(
                        widget.article.author,
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ThemeColors.neutralGrey,
                        ),
                      ),
                      SizedBox(width: ThemeDimensions.defaultPadding),
                      Icon(
                        Icons.access_time,
                        size: 16,
                        color: ThemeColors.neutralGrey,
                      ),
                      SizedBox(width: ThemeDimensions.tinyPadding),
                      Text(
                        widget.article.formattedPublishDate,
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ThemeColors.neutralGrey,
                        ),
                      ),
                      SizedBox(width: ThemeDimensions.defaultPadding),
                      Icon(
                        Icons.visibility,
                        size: 16,
                        color: ThemeColors.neutralGrey,
                      ),
                      SizedBox(width: ThemeDimensions.tinyPadding),
                      Text(
                        '${widget.article.readCount} views',
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ThemeColors.neutralGrey,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.largePadding),

                  // Summary
                  if (widget.article.summary.isNotEmpty) ...[
                    Container(
                      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
                      decoration: BoxDecoration(
                        color: ThemeColors.primaryBlue.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(
                          ThemeDimensions.defaultRadius,
                        ),
                      ),
                      child: Text(
                        widget.article.summary,
                        style: ThemeTextStyles.bodyLarge.copyWith(
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.largePadding),
                  ],

                  // Content
                  Text(
                    widget.article.content,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      height: 1.6,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.largePadding),

                  // Tags
                  if (widget.article.tags.isNotEmpty) ...[
                    DividerWithText(text: 'Tags'),
                    SizedBox(height: ThemeDimensions.defaultPadding),
                    Wrap(
                      spacing: ThemeDimensions.smallPadding,
                      runSpacing: ThemeDimensions.smallPadding,
                      children: widget.article.tags
                          .map((tag) => OutlinedBadge(
                                text: tag,
                                borderColor: ThemeColors.primaryBlue,
                              ))
                          .toList(),
                    ),
                    SizedBox(height: ThemeDimensions.hugePadding),
                  ],

                  // Related Articles Section (placeholder)
                  ListSectionHeader(title: 'Related Articles'),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    'Related articles will appear here',
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.hugePadding),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
