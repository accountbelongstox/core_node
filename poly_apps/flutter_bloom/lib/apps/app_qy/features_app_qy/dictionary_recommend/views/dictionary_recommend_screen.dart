/// Dictionary Recommendation Screen - Refactored with centralized theme and common components
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/custom_app_bar.dart';
import '../../../../../../common/widgets/states/empty_state.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../domain/model/dictionary_model.dart';
import '../domain/service/dictionary_service.dart';
import '../data/dictionary_data.dart';

class DictionaryRecommendScreenRefactoredAppQy extends StatefulWidget {
  const DictionaryRecommendScreenRefactoredAppQy({super.key});

  @override
  State<DictionaryRecommendScreenRefactoredAppQy> createState() =>
      _DictionaryRecommendScreenRefactoredAppQyState();
}

class _DictionaryRecommendScreenRefactoredAppQyState
    extends State<DictionaryRecommendScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final DictionaryService _service = DictionaryService();
  final StorageAppQy _storage = StorageAppQy.instance;
  final TextEditingController _searchController = TextEditingController();
  List<DictionaryModel> _dictionaries = [];
  List<DictionaryModel> _filteredDictionaries = [];
  bool _isLoading = true;
  String? _selectedCategory;
  String? _selectedDifficulty;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    _loadDictionaries();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadDictionaries() async {
    setState(() => _isLoading = true);
    try {
      final cachedDictionaries = await _storage.getApp<List<dynamic>>(
        '${StorageAppQy.keyUserProgress}_dictionaries',
      );
      if (cachedDictionaries != null) {
        _dictionaries = (cachedDictionaries as List<dynamic>)
            .map<DictionaryModel>((json) =>
                DictionaryModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        final mockData = DictionaryData.getMockDictionaries();
        _service.setMockData(mockData);
        _dictionaries = mockData;
        await _storage.setApp(
          '${StorageAppQy.keyUserProgress}_dictionaries',
          _dictionaries.map((d) => d.toJson()).toList(),
        );
      }
      _filteredDictionaries = _dictionaries;
    } catch (e) {
      final mockData = DictionaryData.getMockDictionaries();
      _dictionaries = mockData;
      _filteredDictionaries = mockData;
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _applyFilters() {
    setState(() {
      _filteredDictionaries = _dictionaries.where((dict) {
        // Category filter
        final categoryMatch =
            _selectedCategory == null || dict.category == _selectedCategory;

        // Difficulty filter
        final difficultyMatch = _selectedDifficulty == null ||
            dict.difficulty == _selectedDifficulty;

        // Search query
        final searchMatch = _searchQuery.isEmpty ||
            dict.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            dict.description
                .toLowerCase()
                .contains(_searchQuery.toLowerCase()) ||
            dict.tags.any((tag) =>
                tag.toLowerCase().contains(_searchQuery.toLowerCase()));

        return categoryMatch && difficultyMatch && searchMatch;
      }).toList();
    });
  }

  Future<void> _handleToggleAdd(DictionaryModel dictionary) async {
    try {
      if (dictionary.isAdded) {
        await _service.removeDictionaryFromCollection(dictionary.id);
      } else {
        await _service.addDictionaryToCollection(dictionary.id);
      }

      setState(() {
        final index = _dictionaries.indexWhere((d) => d.id == dictionary.id);
        if (index != -1) {
          _dictionaries[index] =
              _dictionaries[index].copyWith(isAdded: !dictionary.isAdded);
        }
        _applyFilters();
      });

      await _storage.setApp(
        '${StorageAppQy.keyUserProgress}_dictionaries',
        _dictionaries.map((d) => d.toJson()).toList(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              dictionary.isAdded
                  ? QyAppLocalizationKeys.qyCourseUnenrolled.tr(context)
                  : QyAppLocalizationKeys.qyCourseEnrolled.tr(context),
            ),
            backgroundColor: ColorsAppQy.qyPrimary,
            duration: const Duration(seconds: 1),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${QyAppLocalizationKeys.qyError.tr(context)}: $e'),
            backgroundColor: ColorsAppQy.qyError,
          ),
        );
      }
    }
  }

  Future<void> _handleLike(DictionaryModel dictionary) async {
    try {
      await _service.likeDictionary(dictionary.id);

      setState(() {
        final index = _dictionaries.indexWhere((d) => d.id == dictionary.id);
        if (index != -1) {
          _dictionaries[index] = _dictionaries[index].copyWith(
            likeCount: _dictionaries[index].likeCount + 1,
          );
        }
        _applyFilters();
      });

      await _storage.setApp(
        '${StorageAppQy.keyUserProgress}_dictionaries',
        _dictionaries.map((d) => d.toJson()).toList(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❤️ ${QyAppLocalizationKeys.qyLike.tr(context)}!'),
            backgroundColor: ColorsAppQy.qyPrimary,
            duration: const Duration(seconds: 1),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${QyAppLocalizationKeys.qyError.tr(context)}: $e'),
            backgroundColor: ColorsAppQy.qyError,
          ),
        );
      }
    }
  }

  void _handleViewDetails(DictionaryModel dictionary) {
    // TODO: Navigate to dictionary details screen
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(dictionary.title),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  dictionary.imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 150,
                      color: ColorsAppQy.qyCardBackground,
                      child: Icon(
                        Icons.image,
                        size: 48,
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              Text(
                dictionary.description,
                style: ThemeTextStyles.body2.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              _buildDetailRow(
                Icons.book_outlined,
                QyAppLocalizationKeys.qyDictionaryWords.tr(context),
                '${dictionary.wordCount}',
              ),
              _buildDetailRow(
                Icons.favorite,
                QyAppLocalizationKeys.qyDictionaryLikes.tr(context),
                '${dictionary.likeCount}',
              ),
              _buildDetailRow(
                Icons.category,
                QyAppLocalizationKeys.qyCategory.tr(context),
                dictionary.category.tr(context),
              ),
              _buildDetailRow(
                Icons.star,
                QyAppLocalizationKeys.qyDictionaryDifficulty.tr(context),
                dictionary.difficulty.tr(context),
              ),
              _buildDetailRow(
                Icons.person,
                QyAppLocalizationKeys.qyAuthor.tr(context),
                dictionary.author,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: dictionary.tags.map((tag) {
                  return Chip(
                    label: Text(
                      '#${tag.tr(context)}',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyPrimary,
                      ),
                    ),
                    backgroundColor:
                        ColorsAppQy.qyPrimaryLight.withOpacity(0.2),
                    side: BorderSide(
                      color: ColorsAppQy.qyPrimary.withOpacity(0.3),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(QyAppLocalizationKeys.qyClose.tr(context)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _handleToggleAdd(dictionary);
            },
            child: Text(
              dictionary.isAdded
                  ? QyAppLocalizationKeys.qyDictionaryRemove.tr(context)
                  : QyAppLocalizationKeys.qyDictionaryAddToLibrary.tr(context),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            icon,
            size: 18,
            color: ColorsAppQy.qyPrimary,
          ),
          const SizedBox(width: ThemeDimensions.spacing8),
          Text(
            '$label: ',
            style: ThemeTextStyles.body2.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: ThemeTextStyles.body2.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                _buildAppBar(),
                _buildSearchBar(),
                _buildBentoFilters(),
                _buildDictionaryCount(),
                Expanded(
                  child: _isLoading
                      ? Center(
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                                ColorsAppQy.qyPrimary),
                          ),
                        )
                      : _filteredDictionaries.isEmpty
                          ? _buildEmptyState()
                          : _buildBentoDictionaryGrid(),
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
            gradient:
                ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildAppBar() {
    return CustomAppBar(
      title: QyAppLocalizationKeys.qyWordBook.tr(context),
      backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
      titleColor: ColorsAppQy.qyTextPrimary,
      iconColor: ColorsAppQy.qyTextPrimary,
      elevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      actions: [
        IconButton(
          icon: Icon(Icons.refresh, color: ColorsAppQy.qyTextPrimary),
          onPressed: _loadDictionaries,
        ),
      ],
    );
  }

  Widget _buildDictionaryCount() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing8,
      ),
      child: Text(
        '${_filteredDictionaries.length} ${QyAppLocalizationKeys.qyWordBook.tr(context)}',
        style: ThemeTextStyles.body2.copyWith(
          color: ColorsAppQy.qyTextSecondary,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: ColorsAppQy.qyFrostLight,
                width: 1,
              ),
            ),
          ),
          child: TextField(
            controller: _searchController,
            style: ThemeTextStyles.body1.copyWith(
              color: ColorsAppQy.qyTextPrimary,
            ),
            decoration: InputDecoration(
              hintText: QyAppLocalizationKeys.qySearch.tr(context),
              hintStyle: ThemeTextStyles.body1.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
              prefixIcon:
                  Icon(Icons.search, color: ColorsAppQy.qyTextSecondary),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon:
                          Icon(Icons.clear, color: ColorsAppQy.qyTextSecondary),
                      onPressed: () {
                        _searchController.clear();
                        setState(() {
                          _searchQuery = '';
                          _applyFilters();
                        });
                      },
                    )
                  : null,
              filled: true,
              fillColor: ColorsAppQy.qyGlassLight,
              border: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(ThemeDimensions.radiusLarge),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: ThemeDimensions.spacing16,
                vertical: ThemeDimensions.spacing12,
              ),
            ),
            onChanged: (value) {
              setState(() {
                _searchQuery = value;
                _applyFilters();
              });
            },
          ),
        ),
      ),
    );
  }

  Widget _buildBentoFilters() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing8,
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildBentoFilterChip(
              QyAppLocalizationKeys.qyCategory.tr(context),
              _selectedCategory == null
                  ? QyAppLocalizationKeys.qyAll.tr(context)
                  : _selectedCategory!.tr(context),
              [
                QyAppLocalizationKeys.qyAll.tr(context),
                ...DictionaryData.getAllCategories()
                    .map((key) => key.tr(context)),
              ],
              (value) {
                setState(() {
                  final allKey = QyAppLocalizationKeys.qyAll.tr(context);
                  _selectedCategory = value == allKey
                      ? null
                      : DictionaryData.getAllCategories().firstWhere(
                          (key) => key.tr(context) == value,
                        );
                  _applyFilters();
                });
              },
            ),
          ),
          const SizedBox(width: ThemeDimensions.spacing12),
          Expanded(
            child: _buildBentoFilterChip(
              QyAppLocalizationKeys.qyLevel.tr(context),
              _selectedDifficulty == null
                  ? QyAppLocalizationKeys.qyAll.tr(context)
                  : _selectedDifficulty!.tr(context),
              [
                QyAppLocalizationKeys.qyAll.tr(context),
                ...DictionaryData.getAllDifficulties()
                    .map((key) => key.tr(context)),
              ],
              (value) {
                setState(() {
                  final allKey = QyAppLocalizationKeys.qyAll.tr(context);
                  _selectedDifficulty = value == allKey
                      ? null
                      : DictionaryData.getAllDifficulties().firstWhere(
                          (key) => key.tr(context) == value,
                        );
                  _applyFilters();
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBentoFilterChip(String label, String value, List<String> options,
      Function(String) onChanged) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 10,
      opacity: 0.2,
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing12,
        vertical: ThemeDimensions.spacing10,
      ),
      child: InkWell(
        onTap: () {
          showModalBottomSheet(
            context: context,
            backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
            builder: (context) => ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(ThemeDimensions.radiusLarge),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                child: Container(
                  decoration: BoxDecoration(
                    gradient: ColorsAppQy.qyFrostedGlassGradient,
                  ),
                  padding: const EdgeInsets.all(ThemeDimensions.spacing20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$label',
                        style: ThemeTextStyles.title2.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: ThemeDimensions.spacing16),
                      ...options.map((option) => ListTile(
                            title: Text(
                              option,
                              style: ThemeTextStyles.body1.copyWith(
                                color: ColorsAppQy.qyTextPrimary,
                              ),
                            ),
                            trailing: value == option
                                ? Icon(Icons.check,
                                    color: ColorsAppQy.qyPrimary)
                                : null,
                            onTap: () {
                              onChanged(option);
                              Navigator.pop(context);
                            },
                          )),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                value,
                style: ThemeTextStyles.body2.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.w600,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.arrow_drop_down, color: ColorsAppQy.qyPrimary, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoDictionaryGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: ThemeDimensions.spacing16,
        mainAxisSpacing: ThemeDimensions.spacing16,
        childAspectRatio: 0.75,
      ),
      itemCount: _filteredDictionaries.length,
      itemBuilder: (context, index) {
        final dictionary = _filteredDictionaries[index];
        return _buildBentoDictionaryCard(dictionary);
      },
    );
  }

  Widget _buildBentoDictionaryCard(DictionaryModel dictionary) {
    // Use centralized gradient list from ColorsAppQy
    final gradients = ColorsAppQy.qyBentoGradients;
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: EdgeInsets.zero,
      child: InkWell(
        onTap: () => _handleViewDetails(dictionary),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: Container(
          decoration: BoxDecoration(
            gradient: gradients[dictionary.hashCode % gradients.length],
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(ThemeDimensions.radiusLarge),
                  ),
                  child: Image.network(
                    dictionary.imageUrl,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        color: ColorsAppQy.qyFrostLight,
                        child: Icon(
                          Icons.book,
                          size: 48,
                          color: ColorsAppQy.qyTextOnPrimary,
                        ),
                      );
                    },
                  ),
                ),
              ),
              Expanded(
                flex: 2,
                child: Padding(
                  padding: const EdgeInsets.all(ThemeDimensions.spacing12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        dictionary.title,
                        style: ThemeTextStyles.body1.copyWith(
                          color: ColorsAppQy.qyTextOnPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: ThemeDimensions.spacing4),
                      Text(
                        dictionary.description,
                        style: ThemeTextStyles.caption.copyWith(
                          color: ColorsAppQy.qyFrostMedium,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const Spacer(),
                      Row(
                        children: [
                          Icon(Icons.favorite, size: 14, color: ColorsAppQy.qyFrostMedium),
                          const SizedBox(width: ThemeDimensions.spacing4),
                          Text(
                            '${dictionary.likeCount}',
                            style: ThemeTextStyles.caption.copyWith(
                              color: ColorsAppQy.qyFrostMedium,
                            ),
                          ),
                          const SizedBox(width: ThemeDimensions.spacing12),
                          Icon(Icons.book, size: 14, color: ColorsAppQy.qyFrostMedium),
                          const SizedBox(width: ThemeDimensions.spacing4),
                          Text(
                            '${dictionary.wordCount}',
                            style: ThemeTextStyles.caption.copyWith(
                              color: ColorsAppQy.qyFrostMedium,
                            ),
                          ),
                          const Spacer(),
                          IconButton(
                            icon: Icon(
                              dictionary.isAdded
                                  ? Icons.bookmark
                                  : Icons.bookmark_border,
                              color: ColorsAppQy.qyTextOnPrimary,
                              size: 20,
                            ),
                            onPressed: () => _handleToggleAdd(dictionary),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return EmptyState(
      icon: Icons.search_off,
      title: QyAppLocalizationKeys.qyComingSoon.tr(context),
      message: QyAppLocalizationKeys.qyComingSoon.tr(context),
    );
  }
}
