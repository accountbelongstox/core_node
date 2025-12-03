/// Word Book screen with centralized theme + data
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/common/widgets/buttons/primary_button.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../models/word_models.dart';
import 'widgets/word_search_bar.dart';
import 'widgets/word_list_view.dart';
import 'widgets/word_stats_card.dart';

class WordBookScreen extends StatefulWidget {
  const WordBookScreen({super.key});

  @override
  State<WordBookScreen> createState() => _WordBookScreenState();
}

class _WordBookScreenState extends State<WordBookScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  late AnimationController _backgroundController;
  late Animation<double> _backgroundAnimation;
  final TextEditingController _searchController = TextEditingController();
  final StorageAppQy _storage = StorageAppQy.instance;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_handleTabChange);

    _backgroundController = AnimationController(
      duration: const Duration(seconds: 8),
      vsync: this,
    )..repeat(reverse: true);
    _backgroundAnimation = CurvedAnimation(
      parent: _backgroundController,
      curve: Curves.easeInOut,
    );

    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final savedQuery = await _storage.getApp<String>('word_book_search') ?? '';
    final savedTab = await _storage.getApp<int>('word_book_tab') ?? 0;
    if (!mounted) return;

    _searchController.text = savedQuery;
    _searchQuery = savedQuery;
    _tabController.index = savedTab.clamp(0, 3);
    setState(() {});
  }

  void _handleTabChange() {
    if (_tabController.indexIsChanging) return;
    _storage.setApp<int>('word_book_tab', _tabController.index);
  }

  void _persistSearch(String query) {
    _storage.setApp<String>('word_book_search', query);
  }

  @override
  void dispose() {
    _backgroundController.dispose();
    _tabController.removeListener(_handleTabChange);
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: _backgroundAnimation,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient:
                  ColorsAppQy.qyDynamicShimmerGradient(_backgroundAnimation.value),
            ),
            child: child,
          );
        },
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              _buildSearchBar(),
              _buildTabBar(),
              Padding(
                padding: EdgeInsets.all(ThemeDimensions.spacing16),
                child: const WordStatsCard(),
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  physics: const BouncingScrollPhysics(),
                  children: [
                    WordListView(
                      searchQuery: _searchQuery,
                      wordType: WordType.all,
                    ),
                    WordListView(
                      searchQuery: _searchQuery,
                      wordType: WordType.learning,
                    ),
                    WordListView(
                      searchQuery: _searchQuery,
                      wordType: WordType.newWords,
                    ),
                    WordListView(
                      searchQuery: _searchQuery,
                      wordType: WordType.mastered,
                    ),
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
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing12,
      ),
      child: Row(
        children: [
          AnimationUtils.scaleOnTap(
            onTap: () => Navigator.of(context).pop(),
            child: GlassCard(
              borderRadius: ThemeDimensions.borderRadiusM,
              padding: EdgeInsets.all(ThemeDimensions.spacing8),
              child: const Icon(Icons.arrow_back),
            ),
          ),
          SizedBox(width: ThemeDimensions.spacing12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qyWordBookTitle.tr(context),
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyWordBookDesc.tr(context),
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: ThemeDimensions.spacing12),
          AnimationUtils.scaleOnTap(
            onTap: _showFilterDialog,
            child: GlassCard(
              borderRadius: ThemeDimensions.borderRadiusM,
              padding: EdgeInsets.all(ThemeDimensions.spacing8),
              child: const Icon(Icons.filter_list),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing8,
      ),
      child: WordSearchBar(
        controller: _searchController,
        onSearch: (query) {
          setState(() {
            _searchQuery = query;
          });
          _persistSearch(query);
        },
        onClear: () {
          setState(() {
            _searchQuery = '';
          });
          _persistSearch('');
        },
      ),
    );
  }

  Widget _buildTabBar() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      child: GlassCard(
        borderRadius: ThemeDimensions.borderRadiusXL,
        padding: EdgeInsets.zero,
        child: TabBar(
          controller: _tabController,
          indicator: BoxDecoration(
            gradient: ColorsAppQy.qyPrimaryGradient,
            borderRadius: ThemeDimensions.borderRadiusXL,
          ),
          labelStyle: ThemeTextStyles.bodyMedium.copyWith(
            fontWeight: FontWeight.bold,
          ),
          labelColor: ColorsAppQy.qyTextOnPrimary,
          unselectedLabelColor: ColorsAppQy.qyTextSecondary,
          tabs: [
            Tab(text: QyAppLocalizationKeys.qyWordBookWordCount.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyWordBookLearningCount.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyWordBookNewCount.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyWordBookMasteredCount.tr(context)),
          ],
        ),
      ),
    );
  }

  void _showFilterDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
      builder: (context) => GlassCard(
        borderRadius: ThemeDimensions.borderRadiusXL,
        padding: EdgeInsets.all(ThemeDimensions.spacing20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              QyAppLocalizationKeys.qyWordBookFilterTitle.tr(context),
              style: ThemeTextStyles.headlineSmall.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            ListTile(
              leading: Icon(Icons.search, color: ColorsAppQy.qySecondary),
              title: Text(
                QyAppLocalizationKeys.qyWordBookFilterAll.tr(context),
                style: ThemeTextStyles.bodyMedium,
              ),
              onTap: () {
                Navigator.of(context).pop();
                _searchController.clear();
                setState(() {
                  _searchQuery = '';
                });
                _persistSearch('');
              },
            ),
            ListTile(
              leading: Icon(Icons.library_books, color: ColorsAppQy.qyPrimary),
              title: Text(
                QyAppLocalizationKeys.qyWordBookFilterWithinBook.tr(context),
                style: ThemeTextStyles.bodyMedium,
              ),
              onTap: () => Navigator.of(context).pop(),
            ),
            SizedBox(height: ThemeDimensions.spacing20),
            PrimaryButton(
              text: QyAppLocalizationKeys.qyCancel.tr(context),
              onPressed: () => Navigator.of(context).pop(),
              backgroundColor: ColorsAppQy.qyHolographicMedium,
              foregroundColor: ColorsAppQy.qyTextPrimary,
            ),
          ],
        ),
      ),
    );
  }
}