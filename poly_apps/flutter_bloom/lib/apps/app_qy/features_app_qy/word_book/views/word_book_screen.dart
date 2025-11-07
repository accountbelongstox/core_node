/// Word Book screen with search functionality
library;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/gradient_button.dart';
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
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  bool _isSearching = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text;
      });
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
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
              AppTheme.primaryGreen.withOpacity(0.12),
              AppTheme.lightGreen.withOpacity(0.08),
              Colors.white,
              Colors.white,
            ],
            stops: const [0.0, 0.3, 0.8, 1.0],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              _buildSearchBar(),
              _buildTabBar(),
              _buildWordStats(),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
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
              'wordBook.title'.tr,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.filter_list, color: AppTheme.textPrimary),
            onPressed: _showFilterDialog,
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: WordSearchBar(
        controller: _searchController,
        onSearch: (query) {
          setState(() {
            _searchQuery = query;
            _isSearching = query.isNotEmpty;
          });
        },
        onClear: () {
          setState(() {
            _searchQuery = '';
            _isSearching = false;
          });
        },
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(25),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          gradient: AppTheme.primaryGradient,
          borderRadius: BorderRadius.circular(25),
        ),
        labelColor: Colors.white,
        unselectedLabelColor: AppTheme.textSecondary,
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorWeight: 0,
        tabs: [
          Tab(text: 'wordBook.wordCount'.tr),
          Tab(text: 'wordBook.learningCount'.tr),
          Tab(text: 'wordBook.newCount'.tr),
          Tab(text: 'wordBook.masteredCount'.tr),
        ],
      ),
    );
  }

  Widget _buildWordStats() {
    return const Padding(
      padding: EdgeInsets.all(16),
      child: WordStatsCard(),
    );
  }

  void _showFilterDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => GlassmorphismCard(
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'wordBook.search'.tr,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.search, color: AppTheme.primaryGreen),
                title: Text('wordBook.generalSearch'.tr),
                onTap: () {
                  Navigator.of(context).pop();
                  _searchController.clear();
                  FocusScope.of(context).unfocus();
                },
              ),
              ListTile(
                leading: const Icon(Icons.book, color: AppTheme.secondaryGreen),
                title: Text('wordBook.searchInBook'.tr),
                onTap: () {
                  Navigator.of(context).pop();
                  FocusScope.of(context).requestFocus(FocusNode());
                },
              ),
              const SizedBox(height: 16),
              GradientButton(
                text: 'common.cancel'.tr,
                onPressed: () => Navigator.of(context).pop(),
                gradient: AppTheme.oceanGradient,
              ),
            ],
          ),
        ),
      ),
    );
  }
}