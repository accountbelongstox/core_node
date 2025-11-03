/// More Features screen with additional tools and utilities
library more_features_screen;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';

class MoreFeaturesScreen extends StatefulWidget {
  const MoreFeaturesScreen({super.key});

  @override
  State<MoreFeaturesScreen> createState() => _MoreFeaturesScreenState();
}

class _MoreFeaturesScreenState extends State<MoreFeaturesScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  final List<Map<String, dynamic>> _featureGroups = [
    {
      'title': '学习工具',
      'icon': Icons.school,
      'color': AppTheme.primaryGreen,
      'features': [
        {
          'title': '词汇测试',
          'subtitle': '测试你的词汇掌握程度',
          'icon': Icons.quiz,
          'color': AppTheme.primaryGreen,
          'route': '/vocabulary_test',
          'locked': false,
        },
        {
          'title': '发音练习',
          'subtitle': 'AI智能发音纠正',
          'icon': Icons.record_voice_over,
          'color': AppTheme.learningColor,
          'route': '/pronunciation_practice',
          'locked': false,
        },
        {
          'title': '语法练习',
          'subtitle': '语法规则和练习',
          'icon': Icons.text_fields,
          'color': AppTheme.newColor,
          'route': '/grammar_practice',
          'locked': false,
        },
        {
          'title': '写作助手',
          'subtitle': 'AI辅助写作优化',
          'icon': Icons.edit,
          'color': AppTheme.masteredColor,
          'route': '/writing_assistant',
          'locked': true,
        },
      ],
    },
    {
      'title': '个性化功能',
      'icon': Icons.person,
      'color': AppTheme.secondaryGreen,
      'features': [
        {
          'title': '学习计划',
          'subtitle': '定制个性化学习路径',
          'icon': Icons.calendar_today,
          'color': AppTheme.secondaryGreen,
          'route': '/study_plan',
          'locked': false,
        },
        {
          'title': '学习报告',
          'subtitle': '详细的学习数据分析',
          'icon': Icons.analytics,
          'color': AppTheme.info,
          'route': '/learning_report',
          'locked': false,
        },
        {
          'title': '目标设定',
          'subtitle': '设定学习目标和提醒',
          'icon': Icons.flag,
          'color': AppTheme.warning,
          'route': '/goal_setting',
          'locked': false,
        },
        {
          'title': '学习社区',
          'subtitle': '与同学交流分享',
          'icon': Icons.groups,
          'color': AppTheme.primaryGreen,
          'route': '/community',
          'locked': false,
        },
      ],
    },
    {
      'title': '娱乐功能',
      'icon': '🎮',
      'color': AppTheme.success,
      'features': [
        {
          'title': '单词游戏',
          'subtitle': '趣味记忆单词游戏',
          'icon': Icons.games,
          'color': AppTheme.success,
          'route': '/word_games',
          'locked': false,
        },
        {
          'title': '挑战赛',
          'subtitle': '与其他用户比拼学习',
          'icon': EmojiIcons.emoji_events,
          'color': AppTheme.warning,
          'route': '/challenge',
          'locked': false,
        },
        {
          'title': '成就系统',
          'subtitle': '解锁学习成就徽章',
          'icon': EmojiIcons.military_tech,
          'color': AppTheme.learningColor,
          'route': '/achievements',
          'locked': false,
        },
        {
          'title': '排行榜',
          'subtitle': '全球学习排名',
          'icon': EmojiIcons.leaderboard,
          'color': AppTheme.error,
          'route': '/leaderboard',
          'locked': true,
        },
      ],
    },
    {
      'title': '专业工具',
      'icon': Icons.build,
      'color': AppTheme.darkGreen,
      'features': [
        {
          'title': '词典查询',
          'subtitle': '强大的词典工具',
          'icon': Icons.menu_book,
          'color': AppTheme.darkGreen,
          'route': '/dictionary',
          'locked': false,
        },
        {
          'title': '翻译工具',
          'subtitle': '中英文快速翻译',
          'icon': Icons.translate,
          'color': AppTheme.primaryGreen,
          'route': '/translator',
          'locked': false,
        },
        {
          'title': '语法检查',
          'subtitle': '智能语法检查器',
          'icon': Icons.spellcheck',
          'color': AppTheme.warning,
          'route': '/grammar_checker',
          'locked': false,
        },
        {
          'title': '语音助手',
          'subtitle': 'AI语音学习助手',
          'icon': Icons.mic,
          'color': AppTheme.info,
          'route': '/voice_assistant',
          'locked': true,
        },
      ],
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
              AppTheme.auroraGradient.colors[0].withOpacity(0.1),
              AppTheme.auroraGradient.colors[1].withOpacity(0.05),
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
                Expanded(
                  child: _buildFeatureGrid(),
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
                  '更多功能',
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '探索更多学习功能',
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _showSearch,
            child: Icon(
              Icons.search,
              color: AppTheme.primaryGreen,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureGrid() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _featureGroups.length,
      itemBuilder: (context, index) {
        final group = _featureGroups[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: _buildFeatureGroup(group, index),
          ),
        );
      },
    );
  }

  Widget _buildFeatureGroup(Map<String, dynamic> group, int groupIndex) {
    return Container(
      decoration: ComponentStyles.primaryCardDecoration,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              (group['color'] as Color).withOpacity(0.1),
              Colors.white.withOpacity(0.9),
            ],
          ),
          border: Border.all(
            color: (group['color'] as Color).withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: (group['color'] as Color).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      group['icon'] as IconData,
                      color: group['color'] as Color,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    group['title'] as String,
                    style: AppTextStyles.headline5.copyWith(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 1.2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: (group['features'] as List).length,
                itemBuilder: (context, index) {
                  final feature = (group['features'] as List)[index];
                  return _buildFeatureItem(feature, groupIndex, index);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeatureItem(Map<String, dynamic> feature, int groupIndex, int itemIndex) {
    final isLocked = feature['locked'] as bool;

    return BouncingButton(
      onPressed: isLocked ? _showLockedMessage : () => _openFeature(feature),
      child: Container(
        decoration: BoxDecoration(
          color: isLocked ? Colors.grey.shade100 : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isLocked ? Colors.grey.shade300 : (feature['color'] as Color).withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                feature['icon'] as IconData,
                color: isLocked ? Colors.grey.shade400 : feature['color'] as Color,
                size: 28,
              ),
              const SizedBox(height: 8),
              Text(
                feature['title'] as String,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: isLocked ? Colors.grey.shade600 : AppTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                feature['subtitle'] as String,
                style: AppTextStyles.bodySmall.copyWith(
                  color: isLocked ? Colors.grey.shade500 : AppTheme.textSecondary,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openFeature(Map<String, dynamic> feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('正在打开: ${feature['title']}'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _showLockedMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('该功能暂未开放，敬请期待'),
        backgroundColor: AppTheme.warning,
      ),
    );
  }

  void _showSearch() {
    showSearch(
      context: context,
      delegate: SearchDelegate<String>(
        onOpen: (context) {
          // Handle search result
        },
        suggestions: _featureGroups.expand((group)
          => (group['features'] as List).map((feature) => feature['title'] as String)
        ).toList(),
      ),
    );
  }
}

// Custom SearchDelegate for searching features
class FeatureSearchDelegate extends SearchDelegate<String> {
  final List<String> suggestions;

  FeatureSearchDelegate({required this.suggestions});

  @override
  List<Widget> buildActions(BuildContext context) {
    return [
      IconButton(
        icon: const Icon(Icons.close),
        onPressed: () => close(context),
      ),
    ];
  }

  @override
  Widget buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () => close(context),
    );
  }

  @override
  Widget buildResults(BuildContext context, List<String> results) {
    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, index) {
        return ListTile(
          title: Text(results[index]),
          onTap: () {
            close(context, results[index]);
          },
        );
      },
    );
  }

  @override
  Widget buildSuggestions(BuildContext context, List<String> suggestions) {
    return ListView.builder(
      itemCount: suggestions.length,
      itemBuilder: (context, index) {
        return ListTile(
          title: Text(suggestions[index]),
          subtitle: Text('点击搜索相关功能'),
          onTap: () {
            query = suggestions[index];
            showResults(context, suggestions.where((s) =>
              s.toLowerCase().contains(query.toLowerCase())
            ).toList());
          },
        );
      },
    );
  }
}