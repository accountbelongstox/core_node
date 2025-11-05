/// Word Listening Dictation main screen
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
import 'word_listening_dictation_practice_screen.dart';

class WordListeningDictationScreen extends StatefulWidget {
  const WordListeningDictationScreen({super.key});

  @override
  State<WordListeningDictationScreen> createState() => _WordListeningDictationScreenState();
}

class _WordListeningDictationScreenState extends State<WordListeningDictationScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  final List<Map<String, dynamic>> _dictationLevels = [
    {
      'title': '初级听写',
      'subtitle': '基础词汇，慢速播放',
      'level': 'Beginner',
      'icon': Icons.school,
      'color': AppTheme.newColor,
      'wordCount': 500,
      'progress': 0.3,
      'locked': false,
    },
    {
      'title': '中级听写',
      'subtitle': '常用词汇，标准语速',
      'level': 'Intermediate',
      'icon': Icons.trending_up,
      'color': AppTheme.learningColor,
      'wordCount': 1000,
      'progress': 0.0,
      'locked': false,
    },
    {
      'title': '高级听写',
      'subtitle': '专业词汇，快速播放',
      'level': 'Advanced',
      'icon': Icons.psychology,
      'color': AppTheme.masteredColor,
      'wordCount': 1500,
      'progress': 0.0,
      'locked': false,
    },
    {
      'title': '专家听写',
      'subtitle': '复杂句子，原速播放',
      'level': 'Expert',
      'icon': Icons.workspace_premium,
      'color': AppTheme.darkGreen,
      'wordCount': 2000,
      'progress': 0.0,
      'locked': true,
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
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppTheme.learningGradient.colors[0].withOpacity(0.1),
              AppTheme.learningGradient.colors[1].withOpacity(0.05),
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
                  child: _buildDictationLevels(),
                ),
                _buildBottomActions(),
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
            child: Text(
              '单词听写',
              style: AppTextStyles.headline4.copyWith(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          BouncingButton(
            onPressed: _showHelp,
            child: Icon(
              Icons.help_outline,
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
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.headphones,
                    color: AppTheme.primaryGreen,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '听写训练',
                        style: AppTextStyles.headline5.copyWith(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '通过听写提升拼写和听力能力',
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildStatItem(
                    '已掌握',
                    '245',
                    Icons.check_circle,
                    AppTheme.masteredColor,
                  ),
                ),
                Container(
                  width: 1,
                  height: 40,
                  color: AppTheme.borderLight,
                ),
                Expanded(
                  child: _buildStatItem(
                    '练习中',
                    '128',
                    Icons.pending,
                    AppTheme.learningColor,
                  ),
                ),
                Container(
                  width: 1,
                  height: 40,
                  color: AppTheme.borderLight,
                ),
                Expanded(
                  child: _buildStatItem(
                    '准确率',
                    '87%',
                    Icons.trending_up,
                    AppTheme.primaryGreen,
                  ),
                ),
              ],
            ),
          ],
        ),
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
            color: AppTheme.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildDictationLevels() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _dictationLevels.length,
      itemBuilder: (context, index) {
        final level = _dictationLevels[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _buildLevelCard(level, index),
          ),
        );
      },
    );
  }

  Widget _buildLevelCard(Map<String, dynamic> level, int index) {
    final isLocked = level['locked'] as bool;

    return BouncingButton(
      onPressed: isLocked ? _showLockedMessage : () => _startDictation(level),
      child: Container(
        decoration: isLocked
            ? ComponentStyles.primaryCardDecoration.copyWith(
                color: Colors.grey.shade100,
              )
            : ComponentStyles.primaryCardDecoration,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: isLocked
                ? LinearGradient(
                    colors: [Colors.grey.shade100, Colors.grey.shade50],
                  )
                : LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      (level['color'] as Color).withOpacity(0.1),
                      Colors.white.withOpacity(0.9),
                    ],
                  ),
            border: Border.all(
              color: isLocked
                  ? Colors.grey.shade300
                  : (level['color'] as Color).withOpacity(0.3),
              width: 1,
            ),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: isLocked
                          ? Colors.grey.shade300
                          : (level['color'] as Color).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      level['icon'] as IconData,
                      color: isLocked
                          ? Colors.grey.shade500
                          : level['color'] as Color,
                      size: 30,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          level['title'] as String,
                          style: AppTextStyles.headline5.copyWith(
                            color: isLocked
                                ? Colors.grey.shade600
                                : AppTheme.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          level['subtitle'] as String,
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: isLocked
                                ? Colors.grey.shade500
                                : AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (isLocked)
                    Icon(
                      Icons.lock,
                      color: Colors.grey.shade500,
                      size: 24,
                    )
                  else
                    Icon(
                      Icons.play_circle,
                      color: level['color'] as Color,
                      size: 32,
                    ),
                ],
              ),
              if (!isLocked) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _buildProgressIndicator(
                        level['progress'] as double,
                        level['color'] as Color,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      '${level['wordCount']} 词',
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgressIndicator(double progress, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '进度',
              style: AppTextStyles.bodySmall.copyWith(
                color: AppTheme.textSecondary,
              ),
            ),
            Text(
              '${(progress * 100).toInt()}%',
              style: AppTextStyles.bodySmall.copyWith(
                color: color,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          height: 8,
          decoration: BoxDecoration(
            color: AppTheme.surfaceLight,
            borderRadius: BorderRadius.circular(4),
          ),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: progress,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [color, color.withOpacity(0.7)],
                ),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBottomActions() {
    return Container(
      padding: const EdgeInsets.all(16),
      child: BouncingButton(
        onPressed: _showDailyChallenge,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            gradient: AppTheme.sunsetGradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: AppTheme.shadowColored,
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.emoji_events,
                color: Colors.white,
                size: 24,
              ),
              const SizedBox(width: 12),
              Text(
                '每日挑战',
                style: AppTextStyles.buttonText,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _startDictation(Map<String, dynamic> level) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => WordListeningDictationPracticeScreen(
          level: level['level'] as String,
          title: level['title'] as String,
        ),
      ),
    );
  }

  void _showLockedMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('完成当前级别后解锁'),
        backgroundColor: AppTheme.warning,
      ),
    );
  }

  void _showHelp() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Text(
          '听写训练帮助',
          style: AppTextStyles.headline5.copyWith(
            color: AppTheme.textPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '📚 如何练习：',
              style: AppTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '1. 选择适合的难度级别\n2. 点击播放按钮听取单词发音\n3. 在输入框中拼写听到的单词\n4. 提交答案查看结果',
              style: AppTextStyles.bodyMedium,
            ),
            const SizedBox(height: 16),
            Text(
              '💡 小贴士：',
              style: AppTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '• 可以重复播放单词发音\n• 注意大小写\n• 可以使用提示功能\n• 坚持每天练习效果更佳',
              style: AppTextStyles.bodyMedium,
            ),
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
                '知道了',
                style: AppTextStyles.buttonText,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showDailyChallenge() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('每日挑战功能开发中...'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }
}