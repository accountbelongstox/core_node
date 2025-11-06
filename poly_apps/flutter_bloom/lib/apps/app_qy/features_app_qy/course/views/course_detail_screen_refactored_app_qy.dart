// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
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

class CourseDetailScreenRefactoredAppQy extends StatefulWidget {
  const CourseDetailScreenRefactoredAppQy({super.key});

  @override
  State<CourseDetailScreenRefactoredAppQy> createState() =>
      _CourseDetailScreenRefactoredAppQyState();
}

class _CourseDetailScreenRefactoredAppQyState
    extends State<CourseDetailScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isEnrolled = false;

  final Map<String, dynamic> _courseData = {};
  final List<Map<String, dynamic>> _lessons = [];
  final List<Map<String, dynamic>> _reviews = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _initMockData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _initMockData() {
    _courseData.addAll({
      'title': 'IELTS Vocabulary Master Course',
      'subtitle': 'Complete vocabulary preparation for IELTS 7.0+',
      'description':
          'A comprehensive course designed to help you master essential IELTS vocabulary. '
          'Learn 3000+ high-frequency words with real IELTS examples, expert pronunciation guides, '
          'and practical usage tips.',
      'instructor': 'Dr. Sarah Johnson',
      'rating': 4.8,
      'totalReviews': 2458,
      'students': 15230,
      'duration': '8 weeks',
      'level': 'Intermediate to Advanced',
      'category': 'IELTS',
      'isPremium': true,
      'price': 299,
    });

    _lessons.addAll([
      {
        'title': 'Week 1: Academic Vocabulary Foundation',
        'duration': '2 hours',
        'completed': true,
        'lessons': 8,
      },
      {
        'title': 'Week 2: Task 1 Academic Writing Vocabulary',
        'duration': '2.5 hours',
        'completed': true,
        'lessons': 10,
      },
      {
        'title': 'Week 3: Task 2 Essay Vocabulary',
        'duration': '3 hours',
        'completed': false,
        'lessons': 12,
      },
      {
        'title': 'Week 4: Speaking Test Vocabulary',
        'duration': '2 hours',
        'completed': false,
        'lessons': 9,
      },
      {
        'title': 'Week 5: Reading Comprehension Vocabulary',
        'duration': '2.5 hours',
        'completed': false,
        'lessons': 11,
      },
      {
        'title': 'Week 6: Listening Test Vocabulary',
        'duration': '2 hours',
        'completed': false,
        'lessons': 8,
      },
      {
        'title': 'Week 7: Advanced Vocabulary & Collocations',
        'duration': '3 hours',
        'completed': false,
        'lessons': 14,
      },
      {
        'title': 'Week 8: Review & Practice Tests',
        'duration': '4 hours',
        'completed': false,
        'lessons': 10,
      },
    ]);

    _reviews.addAll([
      {
        'userName': 'Alice Wang',
        'rating': 5,
        'date': '2025-10-15',
        'comment':
            'Excellent course! The vocabulary is very practical and helped me achieve 7.5 in IELTS.',
      },
      {
        'userName': 'Michael Chen',
        'rating': 5,
        'date': '2025-10-10',
        'comment':
            'Dr. Johnson explains everything clearly. The examples are from real IELTS tests.',
      },
      {
        'userName': 'Emma Li',
        'rating': 4,
        'date': '2025-10-05',
        'comment':
            'Great content, but I wish there were more practice exercises.',
      },
    ]);
  }

  void _handleEnrollment() {
    setState(() {
      _isEnrolled = !_isEnrolled;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isEnrolled
              ? QyAppLocalizationKeys.qyCourseEnrolled.tr(context)
              : QyAppLocalizationKeys.qyCourseUnenrolled.tr(context),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      body: CustomScrollView(
        slivers: [
          _buildSliverAppBar(),
          SliverToBoxAdapter(
            child: Column(
              children: [
                _buildCourseHeader(),
                _buildTabBar(),
              ],
            ),
          ),
          SliverFillRemaining(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildOverviewTab(),
                _buildCurriculumTab(),
                _buildReviewsTab(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      backgroundColor: ThemeColors.primary,
      leading: IconButton(
        onPressed: () => Navigator.pop(context),
        icon: Icon(Icons.arrow_back, color: ThemeColors.surface),
      ),
      actions: [
        IconButton(
          onPressed: () {},
          icon: Icon(Icons.share, color: ThemeColors.surface),
        ),
        IconButton(
          onPressed: () {},
          icon: Icon(Icons.bookmark_border, color: ThemeColors.surface),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                ThemeColors.primary,
                ThemeColors.primary.withOpacity(0.8),
              ],
            ),
          ),
          child: Center(
            child: Icon(
              Icons.school,
              size: 80,
              color: ThemeColors.surface.withOpacity(0.3),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCourseHeader() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      color: ThemeColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _courseData['title'] as String,
            style: TextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            _courseData['subtitle'] as String,
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Row(
            children: [
              _buildRating(),
              SizedBox(width: Dimensions.spacingLarge),
              _buildInfoItem(Icons.people, '${_courseData['students']}'),
              SizedBox(width: Dimensions.spacingLarge),
              _buildInfoItem(Icons.access_time, _courseData['duration'] as String),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRating() {
    return Row(
      children: [
        Icon(Icons.star, color: Colors.amber, size: 20),
        SizedBox(width: Dimensions.spacingXSmall),
        Text(
          '${_courseData['rating']}',
          style: TextStyles.body1.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        Text(
          ' (${_courseData['totalReviews']})',
          style: TextStyles.caption.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoItem(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: ThemeColors.textSecondary),
        SizedBox(width: Dimensions.spacingXSmall),
        Text(
          text,
          style: TextStyles.caption.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: ThemeColors.surface,
      child: TabBar(
        controller: _tabController,
        indicatorColor: ThemeColors.primary,
        labelColor: ThemeColors.primary,
        unselectedLabelColor: ThemeColors.textSecondary,
        labelStyle: TextStyles.body1.copyWith(fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyles.body1,
        tabs: [
          Tab(text: QyAppLocalizationKeys.qyOverview.tr(context)),
          Tab(text: QyAppLocalizationKeys.qyCurriculum.tr(context)),
          Tab(text: QyAppLocalizationKeys.qyReviews.tr(context)),
        ],
      ),
    );
  }

  Widget _buildOverviewTab() {
    return ListView(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      children: [
        _buildSection(
          QyAppLocalizationKeys.qyAboutCourse.tr(context),
          _courseData['description'] as String,
        ),
        SizedBox(height: Dimensions.spacingLarge),
        _buildInstructorCard(),
        SizedBox(height: Dimensions.spacingLarge),
        _buildCourseInfo(),
      ],
    );
  }

  Widget _buildSection(String title, String content) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Text(
          content,
          style: TextStyles.body2.copyWith(
            color: ThemeColors.textSecondary,
            height: 1.6,
          ),
        ),
      ],
    );
  }

  Widget _buildInstructorCard() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.person,
              size: 32,
              color: ThemeColors.primary,
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qyInstructor.tr(context),
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
                Text(
                  _courseData['instructor'] as String,
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'IELTS Expert & Educator',
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCourseInfo() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildInfoRow(QyAppLocalizationKeys.qyLevel.tr(context), _courseData['level'] as String),
          Divider(color: ThemeColors.border),
          _buildInfoRow(QyAppLocalizationKeys.qyDuration.tr(context), _courseData['duration'] as String),
          Divider(color: ThemeColors.border),
          _buildInfoRow(QyAppLocalizationKeys.qyCategory.tr(context), _courseData['category'] as String),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
          ),
          Text(
            value,
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCurriculumTab() {
    return ListView.builder(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      itemCount: _lessons.length,
      itemBuilder: (context, index) => _buildLessonCard(_lessons[index]),
    );
  }

  Widget _buildLessonCard(Map<String, dynamic> lesson) {
    final isCompleted = lesson['completed'] as bool;

    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(
          color: isCompleted
              ? ThemeColors.success.withOpacity(0.3)
              : ThemeColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(Dimensions.paddingSmall),
            decoration: BoxDecoration(
              color: isCompleted
                  ? ThemeColors.success.withOpacity(0.1)
                  : ThemeColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isCompleted ? Icons.check_circle : Icons.play_circle_outline,
              color: isCompleted ? ThemeColors.success : ThemeColors.primary,
              size: 24,
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lesson['title'] as String,
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Row(
                  children: [
                    Icon(Icons.access_time, size: 14, color: ThemeColors.textTertiary),
                    SizedBox(width: Dimensions.spacingXSmall),
                    Text(
                      lesson['duration'] as String,
                      style: TextStyles.caption.copyWith(
                        color: ThemeColors.textTertiary,
                      ),
                    ),
                    SizedBox(width: Dimensions.spacingMedium),
                    Icon(Icons.article, size: 14, color: ThemeColors.textTertiary),
                    SizedBox(width: Dimensions.spacingXSmall),
                    Text(
                      '${lesson['lessons']} lessons',
                      style: TextStyles.caption.copyWith(
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
    );
  }

  Widget _buildReviewsTab() {
    return ListView.builder(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      itemCount: _reviews.length,
      itemBuilder: (context, index) => _buildReviewCard(_reviews[index]),
    );
  }

  Widget _buildReviewCard(Map<String, dynamic> review) {
    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
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
                child: Icon(Icons.person, color: ThemeColors.primary),
              ),
              SizedBox(width: Dimensions.spacingSmall),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review['userName'] as String,
                      style: TextStyles.body1.copyWith(
                        color: ThemeColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      review['date'] as String,
                      style: TextStyles.caption.copyWith(
                        color: ThemeColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                children: List.generate(
                  5,
                  (index) => Icon(
                    index < (review['rating'] as int)
                        ? Icons.star
                        : Icons.star_border,
                    color: Colors.amber,
                    size: 16,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            review['comment'] as String,
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(top: BorderSide(color: ThemeColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (_courseData['isPremium'] as bool) ...[
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    QyAppLocalizationKeys.qyPrice.tr(context),
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                  Text(
                    '\$${_courseData['price']}',
                    style: TextStyles.h3.copyWith(
                      color: ThemeColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              SizedBox(width: Dimensions.spacingMedium),
            ],
            Expanded(
              child: ElevatedButton(
                onPressed: _handleEnrollment,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isEnrolled
                      ? ThemeColors.success
                      : ThemeColors.primary,
                  padding: EdgeInsets.symmetric(
                    vertical: Dimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  ),
                ),
                child: Text(
                  _isEnrolled
                      ? QyAppLocalizationKeys.qyEnrolled.tr(context)
                      : QyAppLocalizationKeys.qyEnrollNow.tr(context),
                  style: TextStyles.button.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
