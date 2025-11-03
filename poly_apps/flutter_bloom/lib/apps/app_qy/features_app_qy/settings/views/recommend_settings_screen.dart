/// Recommend settings screen
library recommend_settings_screen;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import 'widgets/settings_section.dart';
import 'widgets/settings_tile.dart';

class RecommendSettingsScreen extends StatefulWidget {
  const RecommendSettingsScreen({super.key});

  @override
  State<RecommendSettingsScreen> createState() => _RecommendSettingsScreenState();
}

class _RecommendSettingsScreenState extends State<RecommendSettingsScreen> {
  bool _autoRecommend = true;
  String _difficultyLevel = 'Intermediate';
  List<String> _selectedInterests = ['Business', 'Technology', 'Daily Life'];
  double _recommendationFrequency = 0.7;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryGreen.withOpacity(0.1),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildAutoRecommendSection(),
                    const SizedBox(height: 24),
                    _buildDifficultySection(),
                    const SizedBox(height: 24),
                    _buildInterestsSection(),
                    const SizedBox(height: 24),
                    _buildFrequencySection(),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
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
          IconButton(
            icon: const Icon(Icons.arrow_back, color: AppTheme.textPrimary),
            onPressed: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: Text(
              'settings.recommend'.tr,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAutoRecommendSection() {
    return SettingsSection(
      title: '智能推荐',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.auto_awesome_outlined,
              color: AppTheme.primaryGreen,
            ),
            title: 'settings.autoRecommend'.tr,
            subtitle: '基于学习历史智能推荐单词',
            trailing: Switch(
              value: _autoRecommend,
              onChanged: (value) {
                setState(() {
                  _autoRecommend = value;
                });
              },
              activeColor: AppTheme.primaryGreen,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDifficultySection() {
    return SettingsSection(
      title: '难度设置',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.trending_up_outlined,
              color: AppTheme.secondaryGreen,
            ),
            title: 'settings.difficulty'.tr,
            subtitle: _getDifficultyLabel(_difficultyLevel),
            trailing: const Icon(Icons.chevron_right),
            onTap: _showDifficultyDialog,
          ),
        ],
      ),
    );
  }

  Widget _buildInterestsSection() {
    final interests = [
      'Business', 'Technology', 'Daily Life', 'Academic', 'Medical',
      'Legal', 'Science', 'Arts', 'Sports', 'Travel'
    ];

    return SettingsSection(
      title: '兴趣标签',
      child: Column(
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: interests.map((interest) {
              final isSelected = _selectedInterests.contains(interest);
              return FilterChip(
                label: Text(interest),
                selected: isSelected,
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      _selectedInterests.add(interest);
                    } else {
                      _selectedInterests.remove(interest);
                    }
                  });
                },
                selectedColor: AppTheme.primaryGreen.withOpacity(0.2),
                checkmarkColor: AppTheme.primaryGreen,
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          Text(
            '已选择 ${_selectedInterests.length} 个兴趣标签',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFrequencySection() {
    return SettingsSection(
      title: '推荐频率',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.speed_outlined,
              color: AppTheme.accentGreen,
            ),
            title: '推荐强度',
            subtitle: '${(_recommendationFrequency * 100).toInt()}%',
            trailing: Container(
              width: 200,
              child: Slider(
                value: _recommendationFrequency,
                min: 0.0,
                max: 1.0,
                divisions: 10,
                onChanged: (value) {
                  setState(() {
                    _recommendationFrequency = value;
                  });
                },
                activeColor: AppTheme.primaryGreen,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getDifficultyLabel(String level) {
    switch (level) {
      case 'Beginner':
        return '初级';
      case 'Intermediate':
        return '中级';
      case 'Advanced':
        return '高级';
      case 'Expert':
        return '专家';
      default:
        return level;
    }
  }

  void _showDifficultyDialog() {
    final difficulties = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('选择难度'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: difficulties.length,
            itemBuilder: (context, index) {
              final difficulty = difficulties[index];
              final isSelected = difficulty == _difficultyLevel;
              return ListTile(
                title: Text(_getDifficultyLabel(difficulty)),
                subtitle: Text(_getDifficultyDescription(difficulty)),
                trailing: isSelected
                    ? Icon(Icons.check, color: AppTheme.primaryGreen)
                    : null,
                onTap: () {
                  setState(() {
                    _difficultyLevel = difficulty;
                  });
                  Navigator.of(context).pop();
                },
              );
            },
          ),
        ),
      ),
    );
  }

  String _getDifficultyDescription(String level) {
    switch (level) {
      case 'Beginner':
        return '适合初学者，基础词汇';
      case 'Intermediate':
        return '适合有一定基础的学习者';
      case 'Advanced':
        return '适合高级学习者，专业词汇';
      case 'Expert':
        return '适合专家级学习者，学术词汇';
      default:
        return '';
    }
  }
}