import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/widgets.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/article_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/articles_api_service_app_vipclub.dart';

/// Articles/News Listing Screen
class VipClubArticlesListScreen extends StatefulWidget {
  const VipClubArticlesListScreen({super.key});

  @override
  State<VipClubArticlesListScreen> createState() =>
      _VipClubArticlesListScreenState();
}

class _VipClubArticlesListScreenState extends State<VipClubArticlesListScreen>
    with SingleTickerProviderStateMixin {
  final _articlesService = VipClubArticlesApiService();
  final _searchController = TextEditingController();

  List<VipClubArticleModel> _articles = [];
  List<String> _categories = [];
  String? _selectedCategory;
  bool _isLoading = true;
  String? _error;
  int _currentPage = 1;
  int _totalArticles = 0;

  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _loadCategories();
    _loadArticles();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await _articlesService.getCategories();
      setState(() {
        _categories = ['All', ...categories];
        _tabController = TabController(
          length: _categories.length,
          vsync: this,
        );
        _tabController.addListener(_onTabChanged);
      });
    } catch (e) {
      // Use default categories if API fails
      setState(() {
        _categories = ['All', 'News', 'Events', 'Tips', 'Promotions'];
        _tabController = TabController(
          length: _categories.length,
          vsync: this,
        );
        _tabController.addListener(_onTabChanged);
      });
    }
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) {
      final category = _categories[_tabController.index];
      setState(() {
        _selectedCategory = category == 'All' ? null : category.toLowerCase();
        _currentPage = 1;
      });
      _loadArticles();
    }
  }

  Future<void> _loadArticles() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await _articlesService.getArticles(
        category: _selectedCategory,
        page: _currentPage,
        limit: 20,
      );

      setState(() {
        _articles = result['articles'];
        _totalArticles = result['total'];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _searchArticles(String query) async {
    if (query.isEmpty) {
      _loadArticles();
      return;
    }

    setState(() => _isLoading = true);

    try {
      final articles = await _articlesService.searchArticles(query);
      setState(() {
        _articles = articles;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _openArticle(VipClubArticleModel article) {
    Navigator.pushNamed(
      context,
      '/articles/detail',
      arguments: article,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.neutralWhite,
      appBar: AppBar(
        title: Text('News & Articles'),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
        bottom: _categories.isNotEmpty
            ? TabBar(
                controller: _tabController,
                isScrollable: true,
                indicatorColor: ThemeColors.neutralWhite,
                labelColor: ThemeColors.neutralWhite,
                unselectedLabelColor: ThemeColors.neutralWhite.withOpacity(0.7),
                tabs: _categories
                    .map((category) => Tab(text: category))
                    .toList(),
              )
            : null,
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
            child: SearchField(
              controller: _searchController,
              hintText: 'Search articles...',
              onChanged: (value) {
                // Debounce search
                Future.delayed(Duration(milliseconds: 500), () {
                  if (_searchController.text == value) {
                    _searchArticles(value);
                  }
                });
              },
              onClear: () => _loadArticles(),
            ),
          ),

          // Articles List
          Expanded(
            child: _buildArticlesList(),
          ),
        ],
      ),
    );
  }

  Widget _buildArticlesList() {
    if (_isLoading) {
      return LoadingState(message: 'Loading articles...');
    }

    if (_error != null) {
      return ErrorState(
        title: 'Failed to Load Articles',
        message: _error!,
        onRetry: _loadArticles,
      );
    }

    if (_articles.isEmpty) {
      return EmptyState(
        title: 'No Articles Found',
        message: _searchController.text.isNotEmpty
            ? 'Try a different search term'
            : 'No articles available at the moment',
        icon: Icons.article,
      );
    }

    return RefreshIndicator(
      onRefresh: _loadArticles,
      child: ListView.separated(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        itemCount: _articles.length,
        separatorBuilder: (context, index) =>
            SizedBox(height: ThemeDimensions.defaultPadding),
        itemBuilder: (context, index) {
          final article = _articles[index];
          return _buildArticleCard(article);
        },
      ),
    );
  }

  Widget _buildArticleCard(VipClubArticleModel article) {
    return FeatureCard(
      imageUrl: article.coverImageUrl,
      title: article.title,
      subtitle: article.summary,
      badge: article.isFeatured
          ? StatusBadge(
              text: 'Featured',
              backgroundColor: ThemeColors.accentGold,
              icon: Icons.star,
            )
          : StatusBadge(
              text: article.categoryDisplay,
              backgroundColor: ThemeColors.primaryBlue,
            ),
      onTap: () => _openArticle(article),
      footer: Row(
        children: [
          Icon(
            Icons.person_outline,
            size: 14,
            color: ThemeColors.neutralGrey,
          ),
          SizedBox(width: ThemeDimensions.tinyPadding),
          Text(
            article.author,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
          SizedBox(width: ThemeDimensions.defaultPadding),
          Icon(
            Icons.access_time,
            size: 14,
            color: ThemeColors.neutralGrey,
          ),
          SizedBox(width: ThemeDimensions.tinyPadding),
          Text(
            article.formattedPublishDate,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
          Spacer(),
          Icon(
            Icons.visibility,
            size: 14,
            color: ThemeColors.neutralGrey,
          ),
          SizedBox(width: ThemeDimensions.tinyPadding),
          Text(
            '${article.readCount}',
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
        ],
      ),
    );
  }
}
