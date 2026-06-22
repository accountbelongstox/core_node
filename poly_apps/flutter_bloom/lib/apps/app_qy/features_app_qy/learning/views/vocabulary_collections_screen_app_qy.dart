import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/auth_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/vocabulary_recommendation_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/models_app_qy/vocabulary_models_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/default_language_config_app_qy.dart';

class VocabularyCollectionsScreenAppQy extends StatefulWidget {
  const VocabularyCollectionsScreenAppQy({super.key});

  @override
  State<VocabularyCollectionsScreenAppQy> createState() => _VocabularyCollectionsScreenAppQyState();
}

class _VocabularyCollectionsScreenAppQyState extends State<VocabularyCollectionsScreenAppQy>
    with TickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final VocabularyRecommendationServiceAppQy _service = VocabularyRecommendationServiceAppQy();

  List<VocabularyRecommendationModel> _allRecommendations = [];
  List<VocabularyRecommendationModel> _filteredRecommendations = [];
  bool _isLoading = true;
  String? _error;
  String _selectedCategory = 'all';
  String _selectedLevel = 'all';
  String _selectedLangCode = 'all';
  String _sortBy = 'popular';

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    _loadRecommendations();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadRecommendations() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authService = context.read<AuthServiceAppQy>();
      final user = authService.currentUser;
      final learningLanguages = user?.learningLanguages ?? DefaultLanguageConfigAppQy.defaultLearningLanguages;

      final recommendations = await _service.getRecommendations(
        langCodes: learningLanguages,
      );

      setState(() {
        _allRecommendations = recommendations;
        _applyFilters();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _applyFilters() {
    var filtered = _service.filterRecommendations(
      recommendations: _allRecommendations,
      level: _selectedLevel,
      category: _selectedCategory,
      langCode: _selectedLangCode,
    );

    filtered = _service.sortRecommendations(
      recommendations: filtered,
      sortBy: _sortBy,
    );

    setState(() {
      _filteredRecommendations = filtered;
    });
  }

  Future<void> _toggleSelection(VocabularyRecommendationModel collection) async {
    final action = collection.isSelected ? 'deselect' : 'select';

    final success = await _service.selectCollection(
      collectionId: collection.id,
      action: action,
    );

    if (success) {
      setState(() {
        final index = _allRecommendations.indexWhere((c) => c.id == collection.id);
        if (index != -1) {
          _allRecommendations[index] = collection.copyWith(isSelected: !collection.isSelected);
          _applyFilters();
        }
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(action == 'select' ? 'Collection added' : 'Collection removed'),
            backgroundColor: action == 'select' ? ColorsAppQy.qySuccess : ColorsAppQy.qyWarning,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 1),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                if (!_isLoading && _error == null) _buildFilters(),
                Expanded(
                  child: _isLoading
                      ? _buildLoadingState()
                      : _error != null
                          ? _buildErrorState()
                          : _buildContent(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundGradient() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    final selectedCount = _allRecommendations.where((c) => c.isSelected).length;

    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: ColorsAppQy.qyTextPrimary),
                onPressed: () => context.pop(),
              ),
              const SizedBox(width: ThemeDimensions.spacing8),
              Expanded(
                child: Text(
                  'Vocabulary Collections',
                  style: ThemeTextStyles.title1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (selectedCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing12,
                    vertical: ThemeDimensions.spacing6,
                  ),
                  decoration: BoxDecoration(
                    gradient: ColorsAppQy.qyPrimaryGradient,
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                  ),
                  child: Text(
                    '$selectedCount selected',
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextOnPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing8),
          Padding(
            padding: const EdgeInsets.only(left: 56),
            child: Text(
              'Choose vocabulary collections to study',
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Container(
      height: 50,
      margin: const EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _buildFilterChip('All Categories', 'all', _selectedCategory == 'all', (value) {
            setState(() {
              _selectedCategory = value;
              _applyFilters();
            });
          }),
          _buildFilterChip('Exam', 'exam', _selectedCategory == 'exam', (value) {
            setState(() {
              _selectedCategory = value;
              _applyFilters();
            });
          }),
          _buildFilterChip('Daily', 'daily', _selectedCategory == 'daily', (value) {
            setState(() {
              _selectedCategory = value;
              _applyFilters();
            });
          }),
          _buildFilterChip('Business', 'business', _selectedCategory == 'business', (value) {
            setState(() {
              _selectedCategory = value;
              _applyFilters();
            });
          }),
          _buildFilterChip('Popular', 'popular', _sortBy == 'popular', (value) {
            setState(() {
              _sortBy = value;
              _applyFilters();
            });
          }),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, bool isSelected, Function(String) onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: ThemeDimensions.spacing8),
      child: Material(
        color: ColorsAppQy.qyPageBackground.withOpacity(0),
        child: InkWell(
          onTap: () => onTap(value),
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: ThemeDimensions.spacing16,
              vertical: ThemeDimensions.spacing8,
            ),
            decoration: BoxDecoration(
              gradient: isSelected
                  ? ColorsAppQy.qyPrimaryGradient
                  : null,
              color: !isSelected ? ColorsAppQy.qyFrostLight : null,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
              border: Border.all(
                color: isSelected
                    ? ColorsAppQy.qyPageBackground.withOpacity(0)
                    : ColorsAppQy.qyFrostMedium,
              ),
            ),
            child: Text(
              label,
              style: ThemeTextStyles.caption.copyWith(
                color: isSelected ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: ColorsAppQy.qyError),
          const SizedBox(height: ThemeDimensions.spacing16),
          Text(
            _error ?? 'An error occurred',
            style: ThemeTextStyles.body.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: ThemeDimensions.spacing24),
          ElevatedButton(
            onPressed: _loadRecommendations,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_filteredRecommendations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.library_books_outlined,
              size: 80,
              color: ColorsAppQy.qyTextSecondary.withOpacity(0.5),
            ),
            const SizedBox(height: ThemeDimensions.spacing16),
            Text(
              'No collections found',
              style: ThemeTextStyles.title3.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing8),
            Text(
              'Try changing your filters',
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      itemCount: _filteredRecommendations.length,
      itemBuilder: (context, index) {
        final collection = _filteredRecommendations[index];
        return _buildCollectionCard(collection);
      },
    );
  }

  Widget _buildCollectionCard(VocabularyRecommendationModel collection) {
    final categoryGradient = _getCategoryGradient(collection.category);

    return Padding(
      padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing16),
      child: Material(
        color: ColorsAppQy.qyPageBackground.withOpacity(0),
        child: InkWell(
          onTap: () => _toggleSelection(collection),
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
              child: Container(
                padding: const EdgeInsets.all(ThemeDimensions.spacing16),
                decoration: BoxDecoration(
                  gradient: collection.isSelected
                      ? LinearGradient(
                          colors: [
                            ColorsAppQy.qyPrimary.withOpacity(0.15),
                            ColorsAppQy.qyPrimary.withOpacity(0.05),
                          ],
                        )
                      : ColorsAppQy.qyFrostedGlassGradient,
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                  border: Border.all(
                    color: collection.isSelected
                        ? ColorsAppQy.qyPrimary.withOpacity(0.5)
                        : ColorsAppQy.qyFrostMedium,
                    width: collection.isSelected ? 2 : 1.5,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        gradient: categoryGradient,
                        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            collection.langCode.toUpperCase(),
                            style: ThemeTextStyles.caption.copyWith(
                              color: ColorsAppQy.qyTextOnPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Icon(
                            _getCategoryIcon(collection.category),
                            color: ColorsAppQy.qyTextOnPrimary,
                            size: 24,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: ThemeDimensions.spacing16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  collection.name,
                                  style: ThemeTextStyles.body.copyWith(
                                    color: ColorsAppQy.qyTextPrimary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              if (collection.isPopular)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [ColorsAppQy.qyWarning, ColorsAppQy.qyWarningDark],
                                    ),
                                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.star, size: 12, color: ColorsAppQy.qyTextOnPrimary),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Popular',
                                        style: ThemeTextStyles.caption.copyWith(
                                          color: ColorsAppQy.qyTextOnPrimary,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: ThemeDimensions.spacing4),
                          Text(
                            collection.description ?? collection.categoryDisplay,
                            style: ThemeTextStyles.caption.copyWith(
                              color: ColorsAppQy.qyTextSecondary,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: ThemeDimensions.spacing8),
                          Row(
                            children: [
                              _buildInfoChip(
                                icon: Icons.book_outlined,
                                label: '${collection.totalWords} words',
                              ),
                              const SizedBox(width: ThemeDimensions.spacing8),
                              _buildInfoChip(
                                icon: Icons.signal_cellular_alt,
                                label: collection.difficultyDisplay,
                              ),
                              const SizedBox(width: ThemeDimensions.spacing8),
                              _buildInfoChip(
                                icon: Icons.access_time,
                                label: '${collection.estimatedDays} days',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: ThemeDimensions.spacing12),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        gradient: collection.isSelected ? ColorsAppQy.qyPrimaryGradient : null,
                        border: !collection.isSelected
                            ? Border.all(
                                color: ColorsAppQy.qyFrostMedium,
                                width: 2,
                              )
                            : null,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: collection.isSelected
                          ? Icon(Icons.check, size: 18, color: ColorsAppQy.qyTextOnPrimary)
                          : null,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoChip({required IconData icon, required String label}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: ColorsAppQy.qyTextSecondary),
        const SizedBox(width: 4),
        Text(
          label,
          style: ThemeTextStyles.caption.copyWith(
            color: ColorsAppQy.qyTextSecondary,
            fontSize: 11,
          ),
        ),
      ],
    );
  }

  Gradient _getCategoryGradient(String category) {
    switch (category) {
      case 'exam':
        return LinearGradient(colors: [ColorsAppQy.qyInfo, ColorsAppQy.qyPrimaryDark]);
      case 'business':
        return LinearGradient(colors: [ColorsAppQy.qySuccess, ColorsAppQy.qySecondaryDark]);
      case 'daily':
        return LinearGradient(colors: [ColorsAppQy.qyWarning, ColorsAppQy.qyWarningDark]);
      case 'travel':
        return LinearGradient(colors: [Colors.purple.shade400, Colors.purple.shade600]);
      case 'technical':
        return LinearGradient(colors: [Colors.teal.shade400, Colors.teal.shade600]);
      case 'academic':
        return LinearGradient(colors: [Colors.indigo.shade400, Colors.indigo.shade600]);
      default:
        return ColorsAppQy.qyPrimaryGradient;
    }
  }

  IconData _getCategoryIcon(String category) {
    switch (category) {
      case 'exam':
        return Icons.school;
      case 'business':
        return Icons.business_center;
      case 'daily':
        return Icons.wb_sunny;
      case 'travel':
        return Icons.flight;
      case 'technical':
        return Icons.computer;
      case 'academic':
        return Icons.menu_book;
      default:
        return Icons.library_books;
    }
  }
}
