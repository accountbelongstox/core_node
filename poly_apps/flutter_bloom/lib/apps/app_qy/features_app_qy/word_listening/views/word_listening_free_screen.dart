/// Word Listening Free Mode screen
library;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordListeningFreeScreen extends StatefulWidget {
  const WordListeningFreeScreen({super.key});

  @override
  State<WordListeningFreeScreen> createState() => _WordListeningFreeScreenState();
}

class _WordListeningFreeScreenState extends State<WordListeningFreeScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  List<Map<String, dynamic>> get _wordCategories => [
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryDaily.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryDailyDesc.tr(context),
      'icon': Icons.home,
      'color': AppTheme.primaryGreen,
      'count': 1200,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryBusiness.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryBusinessDesc.tr(context),
      'icon': Icons.business,
      'color': AppTheme.newColor,
      'count': 800,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryAcademic.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryAcademicDesc.tr(context),
      'icon': Icons.school,
      'color': AppTheme.learningColor,
      'count': 600,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryTravel.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryTravelDesc.tr(context),
      'icon': Icons.flight,
      'color': AppTheme.masteredColor,
      'count': 400,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryTech.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryTechDesc.tr(context),
      'icon': Icons.computer,
      'color': AppTheme.darkGreen,
      'count': 500,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryMedical.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryMedicalDesc.tr(context),
      'icon': Icons.local_hospital,
      'color': AppTheme.error,
      'count': 300,
      'locked': false,
    },
  ];

  String _selectedCategory = '';
  bool _isPlaying = false;
  int _currentSpeed = 1; // 0: 慢速, 1: 正常, 2: 快速
  int _listeningTime = 0;
  Timer? _timer;

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
    _timer?.cancel();
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
              AppTheme.lavenderGradient.colors[0].withOpacity(0.1),
              AppTheme.lavenderGradient.colors[1].withOpacity(0.05),
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
                _buildSpeedSelector(),
                _buildStatsHeader(),
                Expanded(
                  child: _buildWordCategories(),
                ),
                _buildCurrentWord(),
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
                  QyAppLocalizationKeys.qyListeningFreeTitle.tr(context),
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyListeningFreeDesc.tr(context),
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _showListeningStats,
            child: Icon(
              Icons.analytics,
              color: AppTheme.primaryGreen,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpeedSelector() {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: ComponentStyles.primaryCardDecoration,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              QyAppLocalizationKeys.qyListeningSpeed.tr(context),
              style: AppTextStyles.headline5.copyWith(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildSpeedButton(0, QyAppLocalizationKeys.qyListeningSpeedSlow.tr(context), Icons.turtle_down, AppTheme.newColor),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildSpeedButton(1, QyAppLocalizationKeys.qyListeningSpeedNormal.tr(context), Icons.play_arrow, AppTheme.primaryGreen),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildSpeedButton(2, QyAppLocalizationKeys.qyListeningSpeedFast.tr(context), Icons.fast_forward, AppTheme.learningColor),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpeedButton(int speed, String label, IconData icon, Color color) {
    final isSelected = _currentSpeed == speed;

    return BouncingButton(
      onPressed: () => setState(() => _currentSpeed = speed),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(
                  colors: [color, color.withOpacity(0.7)],
                )
              : null,
          color: isSelected ? null : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? color : AppTheme.borderLight,
            width: isSelected ? 0 : 2,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : color,
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: AppTextStyles.bodyMedium.copyWith(
                color: isSelected ? Colors.white : color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsHeader() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppTheme.lavenderGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildStatItem(
              QyAppLocalizationKeys.qyListeningTodayListening.tr(context),
              '${(_listeningTime / 60).toInt()} 分钟',
              Icons.access_time,
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
              QyAppLocalizationKeys.qyListeningLearnedWords.tr(context),
              '89',
              Icons.headphones,
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
              QyAppLocalizationKeys.qyListeningStreakDays.tr(context),
              '7 天',
              Icons.local_fire_department,
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
          style: AppTextStyles.bodyLarge.copyWith(
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

  Widget _buildWordCategories() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _wordCategories.length,
      itemBuilder: (context, index) {
        final category = _wordCategories[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: BouncingButton(
              onPressed: () => _selectCategory(category),
              child: Container(
                decoration: ComponentStyles.primaryCardDecoration,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        (category['color'] as Color).withOpacity(0.1),
                        Colors.white.withOpacity(0.9),
                      ],
                    ),
                    border: Border.all(
                      color: (category['color'] as Color).withOpacity(0.3),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: (category['color'] as Color).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          category['icon'] as IconData,
                          color: category['color'] as Color,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              category['title'] as String,
                              style: AppTextStyles.headline5.copyWith(
                                color: AppTheme.textPrimary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              category['subtitle'] as String,
                              style: AppTextStyles.bodyMedium.copyWith(
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${category['count']} 词',
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: category['color'] as Color,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Icon(
                            Icons.play_circle,
                            color: category['color'] as Color,
                            size: 24,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCurrentWord() {
    if (_selectedCategory.isEmpty) {
      return Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(24),
        decoration: ComponentStyles.primaryCardDecoration,
        child: Column(
          children: [
            Icon(
              Icons.category,
              color: AppTheme.textHint,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              QyAppLocalizationKeys.qyListeningSelectCategory.tr(context),
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppTheme.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: ComponentStyles.gradientCardDecoration,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white.withOpacity(0.9),
              Colors.white.withOpacity(0.7),
            ],
          ),
        ),
        child: Column(
          children: [
            Text(
              QyAppLocalizationKeys.qyListeningCurrentWord.tr(context),
              style: AppTextStyles.bodyMedium.copyWith(
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Hello World',
              style: AppTextStyles.headline3.copyWith(
                color: AppTheme.primaryGreen,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '你好，世界',
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: BouncingButton(
                    onPressed: _playCurrentWord,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        gradient: AppTheme.primaryGradient,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isPlaying ? Icons.stop : Icons.play_arrow,
                            color: Colors.white,
                            size: 24,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _isPlaying ? QyAppLocalizationKeys.qyListeningStop.tr(context) : QyAppLocalizationKeys.qyListeningPlay.tr(context),
                            style: AppTextStyles.buttonText,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                BouncingButton(
                  onPressed: _nextWord,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppTheme.primaryGreen,
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      Icons.skip_next,
                      color: AppTheme.primaryGreen,
                      size: 24,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _selectCategory(Map<String, dynamic> category) {
    setState(() {
      _selectedCategory = category['title'] as String;
    });
    _startListening();
  }

  void _startListening() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _listeningTime++;
      });
    });
  }

  void _playCurrentWord() {
    setState(() {
      _isPlaying = !_isPlaying;
    });

    if (_isPlaying && _timer == null) {
      _startListening();
    }

    // Simulate audio playing
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted && _isPlaying) {
        setState(() {
          _isPlaying = false;
        });
      }
    });
  }

  void _nextWord() {
    // Simulate getting next word
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningNextWordTip.tr(context)),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _showListeningStats() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Text(
          QyAppLocalizationKeys.qyListeningStats.tr(context),
          style: AppTextStyles.headline5.copyWith(
            color: AppTheme.textPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildStatsRow(QyAppLocalizationKeys.qyListeningTodayPractice.tr(context), '${(_listeningTime / 60).toInt()} ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}'),
            _buildStatsRow(QyAppLocalizationKeys.qyListeningWeekPractice.tr(context), '245 ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}'),
            _buildStatsRow(QyAppLocalizationKeys.qyListeningTotalTime.tr(context), '1,234 ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}'),
            _buildStatsRow(QyAppLocalizationKeys.qyListeningContinuousDays.tr(context), '7 ${QyAppLocalizationKeys.qyListeningDays.tr(context)}'),
            _buildStatsRow(QyAppLocalizationKeys.qyListeningDailyAverage.tr(context), '176 ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}'),
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
                QyAppLocalizationKeys.qyClose.tr(context),
                style: AppTextStyles.buttonText,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppTheme.textSecondary,
            ),
          ),
          Text(
            value,
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}