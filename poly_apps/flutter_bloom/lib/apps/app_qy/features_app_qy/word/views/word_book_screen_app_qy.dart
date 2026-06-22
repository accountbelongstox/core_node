// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Refactored Word Book Screen for QY App - with proper architecture
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/custom_app_bar.dart';
import '../../../../../../common/widgets/states/empty_state.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';
import '../controllers/word_controller_app_qy.dart';

class WordBookScreenRefactoredAppQy extends StatefulWidget {
  const WordBookScreenRefactoredAppQy({super.key});

  @override
  State<WordBookScreenRefactoredAppQy> createState() =>
      _WordBookScreenRefactoredAppQyState();
}

class _WordBookScreenRefactoredAppQyState
    extends State<WordBookScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final StorageAppQy _storage = StorageAppQy.instance;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    _loadWordBooksFromStorage();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WordControllerAppQy>().loadWordBooks();
    });
  }

  Future<void> _loadWordBooksFromStorage() async {
    try {
      final cachedWordBooks = await _storage.getApp<List<dynamic>>(
        '${StorageAppQy.keyUserProgress}_word_books',
      );
      if (cachedWordBooks != null && mounted) {
        // Word books will be loaded by controller
      }
    } catch (e) {
      // Ignore errors
    }
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _handleSearch(String query) {
    if (query.trim().isEmpty) return;
    context.read<WordControllerAppQy>().searchWords(query);
  }

  void _handleCancel() {
    _searchController.clear();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Consumer<WordControllerAppQy>(
              builder: (context, controller, child) {
                return Column(
                  children: [
                    CustomAppBar(
                      title: QyAppLocalizationKeys.qyWordBook.tr(context),
                      backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
                      titleColor: ColorsAppQy.qyTextPrimary,
                      iconColor: ColorsAppQy.qyTextPrimary,
                      elevation: 0,
                      systemOverlayStyle: SystemUiOverlayStyle.dark,
                    ),
                    _buildSearchSection(controller),
                    _buildSearchOptions(controller),
                    Expanded(
                      child: controller.isLoading
                          ? Center(
                              child: CircularProgressIndicator(
                                color: ColorsAppQy.qyPrimary,
                              ),
                            )
                          : _buildWordBooksList(controller),
                    ),
                    const BottomNavigationAppQy(currentIndex: 0),
                  ],
                );
              },
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

  Widget _buildSearchSection(WordControllerAppQy controller) {
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
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onSubmitted: _handleSearch,
                  autofocus: true,
                  style: ThemeTextStyles.body1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                  ),
                  decoration: InputDecoration(
                    hintText: QyAppLocalizationKeys.qySearchPlaceholder.tr(context),
                    hintStyle: ThemeTextStyles.body2.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    prefixIcon: Icon(Icons.search, color: ColorsAppQy.qyTextSecondary),
                    filled: true,
                    fillColor: ColorsAppQy.qyFrostMedium,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                      borderSide: BorderSide(
                        color: ColorsAppQy.qyPrimary,
                        width: 2,
                      ),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.spacing16,
                      vertical: ThemeDimensions.spacing12,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: ThemeDimensions.spacing12),
              TextButton(
                onPressed: _handleCancel,
                child: Text(
                  QyAppLocalizationKeys.qyCancel.tr(context),
                  style: ThemeTextStyles.button.copyWith(
                    color: ColorsAppQy.qyPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSearchOptions(WordControllerAppQy controller) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing8,
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildSearchOptionButton(
              QyAppLocalizationKeys.qyGeneralSearch.tr(context),
              controller.searchOption == 0,
              () => controller.setSearchOption(0),
            ),
          ),
          const SizedBox(width: ThemeDimensions.spacing12),
          Expanded(
            child: _buildSearchOptionButton(
              QyAppLocalizationKeys.qyBookSearch.tr(context),
              controller.searchOption == 1,
              () => controller.setSearchOption(1),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchOptionButton(
    String text,
    bool isSelected,
    VoidCallback onTap,
  ) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 10,
      opacity: isSelected ? 0.3 : 0.1,
      padding: const EdgeInsets.symmetric(
        vertical: ThemeDimensions.spacing12,
        horizontal: ThemeDimensions.spacing16,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: Container(
          decoration: isSelected
              ? BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                )
              : null,
          child: Center(
            child: Text(
              text,
              style: ThemeTextStyles.button.copyWith(
                color: isSelected
                    ? ColorsAppQy.qyTextOnPrimary
                    : ColorsAppQy.qyTextPrimary,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWordBooksList(WordControllerAppQy controller) {
    if (controller.wordBooks.isEmpty) {
      return _buildEmptyState();
    }

    return ListView.builder(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      itemCount: controller.wordBooks.length,
      itemBuilder: (context, index) {
        final wordBook = controller.wordBooks[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing16),
          child: _buildWordBookCard(wordBook),
        );
      },
    );
  }

  Widget _buildWordBookCard(dynamic wordBook) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  wordBook.name,
                  style: ThemeTextStyles.h4.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              IconButton(
                onPressed: () {},
                icon: Icon(
                  Icons.volume_up,
                  color: ColorsAppQy.qyPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing8),
          Text(
            wordBook.description,
            style: ThemeTextStyles.body2.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Row(
            children: [
              Expanded(
                child: _buildStatItem(
                  QyAppLocalizationKeys.qyTotal.tr(context),
                  wordBook.totalWords.toString(),
                ),
              ),
              Expanded(
                child: _buildStatItem(
                  QyAppLocalizationKeys.qyLearned.tr(context),
                  wordBook.learnedWords.toString(),
                ),
              ),
              Expanded(
                child: _buildStatItem(
                  QyAppLocalizationKeys.qyRemaining.tr(context),
                  wordBook.remainingWords.toString(),
                ),
              ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: wordBook.progress / 100,
              minHeight: 6,
              backgroundColor: ColorsAppQy.qyFrostMedium,
              valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: ThemeTextStyles.caption.copyWith(
            color: ColorsAppQy.qyTextSecondary,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing4),
        Text(
          value,
          style: ThemeTextStyles.h4.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return EmptyState(
      icon: Icons.book_outlined,
      title: QyAppLocalizationKeys.qyNoWordBooks.tr(context),
      message: QyAppLocalizationKeys.qyComingSoon.tr(context),
    );
  }
}
