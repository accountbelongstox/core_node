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

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/course_controller_app_qy.dart';

class CourseReviewScreenRefactoredAppQy extends StatefulWidget {
  final String courseId;

  const CourseReviewScreenRefactoredAppQy({
    super.key,
    required this.courseId,
  });

  @override
  State<CourseReviewScreenRefactoredAppQy> createState() =>
      _CourseReviewScreenRefactoredAppQyState();
}

class _CourseReviewScreenRefactoredAppQyState
    extends State<CourseReviewScreenRefactoredAppQy> {
  final List<Map<String, dynamic>> _reviews = [];
  double _averageRating = 0.0;
  int _totalReviews = 0;
  final Map<int, int> _ratingDistribution = {};

  @override
  void initState() {
    super.initState();
    _initReviews();
  }

  void _initReviews() {
    _averageRating = 4.6;
    _totalReviews = 342;
    _ratingDistribution[5] = 210;
    _ratingDistribution[4] = 98;
    _ratingDistribution[3] = 24;
    _ratingDistribution[2] = 7;
    _ratingDistribution[1] = 3;

    _reviews.addAll([
      {
        'id': 'r1',
        'userName': 'Sarah Johnson',
        'userAvatar': Icons.person,
        'rating': 5,
        'date': '2024-02-28',
        'review':
            'Excellent course! The content is well-structured and easy to follow. I have improved my English significantly.',
        'helpful': 45,
      },
      {
        'id': 'r2',
        'userName': 'Michael Chen',
        'userAvatar': Icons.person,
        'rating': 4,
        'date': '2024-02-25',
        'review':
            'Great course overall. The lessons are practical and the exercises are helpful. Would recommend!',
        'helpful': 32,
      },
      {
        'id': 'r3',
        'userName': 'Emily Brown',
        'userAvatar': Icons.person,
        'rating': 5,
        'date': '2024-02-20',
        'review':
            'This is exactly what I needed to improve my business English. The instructor is knowledgeable and the materials are top-notch.',
        'helpful': 28,
      },
      {
        'id': 'r4',
        'userName': 'David Kim',
        'userAvatar': Icons.person,
        'rating': 4,
        'date': '2024-02-15',
        'review':
            'Very good course. The pronunciation section is particularly helpful. Minor issue with some audio quality.',
        'helpful': 19,
      },
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyReviews.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        actions: [
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.add_comment, color: ThemeColors.textPrimary),
          ),
        ],
      ),
      body: ListView(
        children: [
          _buildRatingOverview(),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildReviewsList(),
        ],
      ),
    );
  }

  Widget _buildRatingOverview() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          bottom: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                flex: 2,
                child: Column(
                  children: [
                    Text(
                      _averageRating.toStringAsFixed(1),
                      style: TextStyle(
                        fontSize: 56,
                        fontWeight: FontWeight.bold,
                        color: ThemeColors.textPrimary,
                      ),
                    ),
                    _buildStarRating(_averageRating),
                    SizedBox(height: ThemeDimensions.spacingSmall),
                    Text(
                      '$_totalReviews ${QyAppLocalizationKeys.qyReviews.tr(context)}',
                      style: ThemeTextStyles.body2.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingLarge),
              Expanded(
                flex: 3,
                child: Column(
                  children: List.generate(5, (index) {
                    final rating = 5 - index;
                    return _buildRatingBar(rating);
                  }),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStarRating(double rating) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        if (index < rating.floor()) {
          return Icon(Icons.star, color: Colors.amber, size: 20);
        } else if (index < rating) {
          return Icon(Icons.star_half, color: Colors.amber, size: 20);
        } else {
          return Icon(Icons.star_border, color: Colors.amber, size: 20);
        }
      }),
    );
  }

  Widget _buildRatingBar(int rating) {
    final count = _ratingDistribution[rating] ?? 0;
    final percentage = count / _totalReviews;

    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.spacingSmall),
      child: Row(
        children: [
          Text(
            '$rating',
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingXSmall),
          Icon(Icons.star, size: 14, color: Colors.amber),
          SizedBox(width: ThemeDimensions.spacingSmall),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
              child: LinearProgressIndicator(
                value: percentage,
                minHeight: 8,
                backgroundColor: ThemeColors.border,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.amber),
              ),
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingSmall),
          SizedBox(
            width: 30,
            child: Text(
              count.toString(),
              style: ThemeTextStyles.caption.copyWith(
                color: ThemeColors.textSecondary,
              ),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewsList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingMedium,
            vertical: ThemeDimensions.paddingSmall,
          ),
          child: Text(
            QyAppLocalizationKeys.qyUserReviews.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        ...List.generate(_reviews.length, (index) {
          return _buildReviewCard(_reviews[index]);
        }),
      ],
    );
  }

  Widget _buildReviewCard(Map<String, dynamic> review) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          bottom: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: ThemeColors.primary.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  review['userAvatar'] as IconData,
                  color: ThemeColors.primary,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingMedium),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review['userName'] as String,
                      style: ThemeTextStyles.body1.copyWith(
                        color: ThemeColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.spacingXSmall),
                    Row(
                      children: [
                        Row(
                          children: List.generate(5, (index) {
                            return Icon(
                              index < (review['rating'] as int)
                                  ? Icons.star
                                  : Icons.star_border,
                              size: 14,
                              color: Colors.amber,
                            );
                          }),
                        ),
                        SizedBox(width: ThemeDimensions.spacingSmall),
                        Text(
                          review['date'] as String,
                          style: ThemeTextStyles.caption.copyWith(
                            color: ThemeColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            review['review'] as String,
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
              height: 1.5,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Row(
            children: [
              InkWell(
                onTap: () {},
                child: Row(
                  children: [
                    Icon(
                      Icons.thumb_up_outlined,
                      size: 16,
                      color: ThemeColors.textSecondary,
                    ),
                    SizedBox(width: ThemeDimensions.spacingXSmall),
                    Text(
                      QyAppLocalizationKeys.qyHelpful.tr(context),
                      style: ThemeTextStyles.caption.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                    ),
                    SizedBox(width: ThemeDimensions.spacingXSmall),
                    Text(
                      '(${review['helpful']})',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ThemeColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
