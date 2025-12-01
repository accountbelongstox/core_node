/// More Features screen with additional tools and utilities
library;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../models/more_features_model.dart';
import '../data/more_features_data.dart';

class MoreFeaturesScreen extends StatefulWidget {
  const MoreFeaturesScreen({super.key});

  @override
  State<MoreFeaturesScreen> createState() => _MoreFeaturesScreenState();
}

class _MoreFeaturesScreenState extends State<MoreFeaturesScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  List<FeatureGroupModel> get _featureGroups =>
      MoreFeaturesData.getFeatureGroups();

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
              ColorsAppQy.qyTextOnPrimary,
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
                  QyAppLocalizationKeys.qyMoreFeatures.tr(context),
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyMoreFeaturesSubtitle.tr(context),
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

  Widget _buildFeatureGroup(FeatureGroupModel group, int groupIndex) {
    return Container(
      decoration: ComponentStyles.primaryCardDecoration,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              group.color.withOpacity(0.1),
              ColorsAppQy.qyFrostWhite,
            ],
          ),
          border: Border.all(
            color: group.color.withOpacity(0.3),
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
                      color: group.color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: group.icon != null
                        ? Icon(
                            group.icon!,
                            color: group.color,
                            size: 24,
                          )
                        : Text(
                            group.emojiIcon ?? '',
                            style: const TextStyle(fontSize: 24),
                          ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    group.titleKey.tr(context),
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
                itemCount: group.features.length,
                itemBuilder: (context, index) {
                  final feature = group.features[index];
                  return _buildFeatureItem(feature, groupIndex, index);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeatureItem(
      FeatureItemModel feature, int groupIndex, int itemIndex) {
    final isLocked = feature.locked;

    return BouncingButton(
      onPressed: isLocked ? _showLockedMessage : () => _openFeature(feature),
      child: Container(
        decoration: BoxDecoration(
          color: isLocked ? ColorsAppQy.qyBorderLight : ColorsAppQy.qyTextOnPrimary,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isLocked
                ? ColorsAppQy.qyBorderMedium
                : feature.color.withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                feature.icon,
                color: isLocked ? ColorsAppQy.qyTextTertiary : feature.color,
                size: 28,
              ),
              const SizedBox(height: 8),
              Text(
                feature.titleKey.tr(context),
                style: AppTextStyles.bodyMedium.copyWith(
                  color: isLocked ? ColorsAppQy.qyTextTertiary : AppTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                feature.subtitleKey.tr(context),
                style: AppTextStyles.bodySmall.copyWith(
                  color:
                      isLocked ? ColorsAppQy.qyTextTertiary : AppTheme.textSecondary,
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

  void _openFeature(FeatureItemModel feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
            '${QyAppLocalizationKeys.qyOpeningFeature.tr(context)}: ${feature.titleKey.tr(context)}'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _showLockedMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyFeatureNotAvailable.tr(context)),
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
        suggestions: _featureGroups
            .expand((group) =>
                group.features.map((feature) => feature.titleKey.tr(context)))
            .toList(),
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
          subtitle:
              Text(QyAppLocalizationKeys.qyClickToSearchFeatures.tr(context)),
          onTap: () {
            query = suggestions[index];
            showResults(
                context,
                suggestions
                    .where((s) => s.toLowerCase().contains(query.toLowerCase()))
                    .toList());
          },
        );
      },
    );
  }
}
