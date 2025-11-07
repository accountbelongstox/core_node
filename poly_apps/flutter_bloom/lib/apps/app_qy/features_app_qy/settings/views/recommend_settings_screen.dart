/// Recommend settings screen
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../widgets/settings_section.dart';
import '../widgets/settings_tile.dart';

class RecommendSettingsScreen extends StatefulWidget {
  const RecommendSettingsScreen({super.key});

  @override
  State<RecommendSettingsScreen> createState() => _RecommendSettingsScreenState();
}

class _RecommendSettingsScreenState extends State<RecommendSettingsScreen> {
  bool _autoRecommend = true;
  String _difficultyLevel = 'Intermediate';
  final List<String> _selectedInterests = ['Business', 'Technology', 'Daily Life'];
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
              'settings.recommend'.tr(context),
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
      title: QyAppLocalizationKeys.qySettingsSmartRecommendation.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.auto_awesome_outlined,
              color: AppTheme.primaryGreen,
            ),
            title: 'settings.autoRecommend'.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsAutoRecommendSubtitle.tr(context),
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
      title: QyAppLocalizationKeys.qySettingsDifficultySettings.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.trending_up_outlined,
              color: AppTheme.secondaryGreen,
            ),
            title: 'settings.difficulty'.tr(context),
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
      title: QyAppLocalizationKeys.qySettingsInterestTags.tr(context),
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
            QyAppLocalizationKeys.qySettingsInterestTagsSelected.tr(context).replaceAll('{count}', '${_selectedInterests.length}'),
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
      title: QyAppLocalizationKeys.qySettingsRecommendationFrequency.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.speed_outlined,
              color: AppTheme.accentGreen,
            ),
            title: QyAppLocalizationKeys.qySettingsRecommendationStrength.tr(context),
            subtitle: '${(_recommendationFrequency * 100).toInt()}%',
            trailing: SizedBox(
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
        return QyAppLocalizationKeys.qySettingsDifficultyBeginner.tr(context);
      case 'Intermediate':
        return QyAppLocalizationKeys.qySettingsDifficultyIntermediate.tr(context);
      case 'Advanced':
        return QyAppLocalizationKeys.qySettingsDifficultyAdvanced.tr(context);
      case 'Expert':
        return QyAppLocalizationKeys.qySettingsDifficultyExpert.tr(context);
      default:
        return level;
    }
  }

  void _showDifficultyDialog() {
    final difficulties = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsSelectDifficulty.tr(context)),
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
        return QyAppLocalizationKeys.qySettingsDifficultyBeginnerDesc.tr(context);
      case 'Intermediate':
        return QyAppLocalizationKeys.qySettingsDifficultyIntermediateDesc.tr(context);
      case 'Advanced':
        return QyAppLocalizationKeys.qySettingsDifficultyAdvancedDesc.tr(context);
      case 'Expert':
        return QyAppLocalizationKeys.qySettingsDifficultyExpertDesc.tr(context);
      default:
        return '';
    }
  }
}