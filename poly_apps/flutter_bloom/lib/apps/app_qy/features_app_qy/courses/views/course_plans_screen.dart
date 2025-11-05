/// Course Plans screen with learning roadmap and schedules
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';

class CoursePlansScreen extends StatefulWidget {
  const CoursePlansScreen({super.key});

  @override
  State<CoursePlansScreen> createState() => _CoursePlansScreenState();
}

class _CoursePlansScreenState extends State<CoursePlansScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  final List<Map<String, dynamic>> _coursePlans = [
    {
      'title': '雅思30天速成班',
      'subtitle': '短期高强度雅思备考',
      'level': 'IELTS Advanced',
      'duration': '30天',
      'price': '¥2999',
      'students': 1234,
      'rating': 4.8,
      'progress': 0.0,
      'locked': false,
      'badge': '热门',
      'badgeColor': AppTheme.error,
      'icon': Icons.speed,
      'gradient': AppTheme.sunsetGradient,
    },
    {
      'title': '商务英语进阶',
      'subtitle': '职场沟通能力提升',
      'level': 'Business Intermediate',
      'duration': '60天',
      'price': '¥1999',
      'students': 892,
      'rating': 4.7,
      'progress': 0.25,
      'locked': false,
      'badge': '推荐',
      'badgeColor': AppTheme.primaryGreen,
      'icon': Icons.business_center,
      'gradient': AppTheme.primaryGradient,
    },
    {
      'title': 'Python编程入门',
      'subtitle': '零基础学习Python',
      'level': 'Programming Beginner',
      'duration': '45天',
      'price': '¥2499',
      'students': 567,
      'rating': 4.9,
      'progress': 0.0,
      'locked': false,
      'badge': '新课',
      'badgeColor': AppTheme.newColor,
      'icon': Icons.code,
      'gradient': AppTheme.oceanGradient,
    },
    {
      'title': '口语流利训练',
      'subtitle': '提升英语口语表达能力',
      'level': 'Speaking Advanced',
      'duration': '90天',
      'price': '¥3499',
      'students': 445,
      'rating': 4.6,
      'progress': 0.0,
      'locked': false,
      'icon': Icons.record_voice_over,
      'gradient': AppTheme.lavenderGradient,
    },
    {
      'title': '学术英语写作',
      'subtitle': '学术论文写作技巧',
      'level': 'Academic Advanced',
      'duration': '120天',
      'price': '¥3999',
      'students': 234,
      'rating': 4.5,
      'progress': 0.0,
      'locked': true,
      'icon': Icons.edit,
      'gradient': AppTheme.peachGradient,
    },
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.primaryCurve),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.peachGradient.colors[0].withOpacity(0.1),
              AppTheme.peachGradient.colors[1].withOpacity(0.05),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Column(
              children: [
                _buildAppBar(),
                _buildStatsHeader(),
                Expanded(
                  child: _buildCoursePlans(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Icon(
              Icons.arrow_back,
              color: AppTheme.textPrimary,
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  '课程计划',
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '制定你的学习计划',
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _showFilterDialog,
            child: Icon(
              Icons.filter_list,
              color: AppTheme.primaryGreen,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsHeader() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppTheme.sunsetGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildStatItem(
              '进行中',
              '2',
              Icons.play_circle,
              Colors.white,
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withOpacity(0.3),
          ),
          Expanded(
            child: _buildStatItem(
              '已完成',
              '5',
              Icons.check_circle,
              Colors.white,
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withOpacity(0.3),
          ),
          Expanded(
            child: _buildStatItem(
              '总时长',
              '165h',
              Icons.access_time,
              Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 8),
        Text(
          value,
          style: AppTextStyles.headline4.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: AppTextStyles.bodySmall.copyWith(
            color: color.withOpacity(0.9),
          ),
        ),
      ],
    );
  }

  Widget _buildCoursePlans() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _coursePlans.length,
      itemBuilder: (context, index) {
        final plan = _coursePlans[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _buildCoursePlanCard(plan, index),
          ),
        );
      },
    );
  }

  Widget _buildCoursePlanCard(Map<String, dynamic> plan, int index) {
    final isLocked = plan['locked'] as bool;

    return BouncingButton(
      onPressed: isLocked ? _showLockedMessage : () => _openCoursePlan(plan),
      child: Container(
        decoration: ComponentStyles.primaryCardDecoration,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: (plan['gradient'] as LinearGradient),
          ),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white.withOpacity(0.95),
                  Colors.white.withOpacity(0.9),
                ],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                plan['title'] as String,
                                style: AppTextStyles.headline5.copyWith(
                                  color: AppTheme.textPrimary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(width: 8),
                              if (plan['badge'] != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: (plan['badgeColor'] as Color),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    plan['badge'] as String,
                                    style: AppTextStyles.bodySmall.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            plan['subtitle'] as String,
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Icon(
                                Icons.schedule,
                                color: AppTheme.textHint,
                                size: 16,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                plan['duration'] as String,
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppTheme.textSecondary,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Icon(
                                Icons.price_check,
                                color: AppTheme.textHint,
                                size: 16,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                plan['price'] as String,
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppTheme.primaryGreen,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        color: (plan['gradient'] as LinearGradient).colors[0].withOpacity(0.2),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        plan['icon'] as IconData,
                        color: (plan['gradient'] as LinearGradient).colors[0],
                        size: 30,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _buildRatingBar(plan['rating'] as double),
                    ),
                    Text(
                      '(${plan['students']}人)',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
                if (!(plan['progress'] as double).isNaN && (plan['progress'] as double) > 0) ...[
                  const SizedBox(height: 16),
                  _buildProgressBar(plan['progress'] as double),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Text(
                      plan['level'] as String,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const Spacer(),
                    if (isLocked)
                      Icon(
                        Icons.lock,
                        color: AppTheme.textHint,
                        size: 20,
                      )
                    else
                      Icon(
                        Icons.play_circle,
                        color: AppTheme.primaryGreen,
                        size: 24,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRatingBar(double rating) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        return Icon(
          index < rating.floor()
              ? Icons.star
              : index < rating
                  ? Icons.star_half
                  : Icons.star_border,
          color: index < rating
              ? AppTheme.warning
              : AppTheme.borderLight,
          size: 16,
        );
      }),
    );
  }

  Widget _buildProgressBar(double progress) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '学习进度',
              style: AppTextStyles.bodySmall.copyWith(
                color: AppTheme.textSecondary,
              ),
            ),
            Text(
              '${(progress * 100).toInt()}%',
              style: AppTextStyles.bodySmall.copyWith(
                color: AppTheme.primaryGreen,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          height: 6,
          decoration: BoxDecoration(
            color: AppTheme.surfaceLight,
            borderRadius: BorderRadius.circular(3),
          ),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: progress,
            child: Container(
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _openCoursePlan(Map<String, dynamic> plan) {
    // Navigate to course plan detail screen
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('正在打开课程: ${plan['title']}'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _showLockedMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('该课程暂未开放'),
        backgroundColor: AppTheme.warning,
      ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Text(
          '筛选课程',
          style: AppTextStyles.headline5.copyWith(
            color: AppTheme.textPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildFilterOption('难度级别', ['全部', '初级', '中级', '高级']),
            _buildFilterOption('课程时长', ['全部', '30天', '60天', '90天以上']),
            _buildFilterOption('价格范围', ['全部', '0-1000', '1000-3000', '3000+']),
          ],
        ),
        actions: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: AppTheme.primaryGreen,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '确定',
                style: AppTextStyles.buttonText,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterOption(String title, List<String> options) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: options.map((option) {
              return BouncingButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: option == '全部' ? AppTheme.primaryGreen : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: option == '全部' ? Colors.transparent : AppTheme.borderLight,
                    ),
                  ),
                  child: Text(
                    option,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: option == '全部' ? Colors.white : AppTheme.textPrimary,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}