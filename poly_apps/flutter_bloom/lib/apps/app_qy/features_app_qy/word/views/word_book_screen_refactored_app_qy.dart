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

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/word_controller_app_qy.dart';

class WordBookScreenRefactoredAppQy extends StatefulWidget {
  const WordBookScreenRefactoredAppQy({super.key});

  @override
  State<WordBookScreenRefactoredAppQy> createState() =>
      _WordBookScreenRefactoredAppQyState();
}

class _WordBookScreenRefactoredAppQyState
    extends State<WordBookScreenRefactoredAppQy> {
  final TextEditingController _searchController;

  _WordBookScreenRefactoredAppQyState()
      : _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WordControllerAppQy>().loadWordBooks();
    });
  }

  @override
  void dispose() {
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
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyWordBook.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: Consumer<WordControllerAppQy>(
        builder: (context, controller, child) {
          return SafeArea(
            child: Column(
              children: [
                _buildSearchSection(controller),
                _buildSearchOptions(controller),
                Expanded(
                  child: controller.isLoading
                      ? Center(
                          child: CircularProgressIndicator(
                            color: ThemeColors.primary,
                          ),
                        )
                      : _buildWordBooksList(controller),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchSection(WordControllerAppQy controller) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchController,
              onSubmitted: _handleSearch,
              autofocus: true,
              style: TextStyles.body1.copyWith(color: ThemeColors.textPrimary),
              decoration: InputDecoration(
                hintText: QyAppLocalizationKeys.qySearchPlaceholder.tr(context),
                hintStyle:
                    TextStyles.body2.copyWith(color: ThemeColors.textTertiary),
                prefixIcon:
                    Icon(Icons.search, color: ThemeColors.textSecondary),
                filled: true,
                fillColor: ThemeColors.background,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  borderSide: BorderSide(color: ThemeColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  borderSide: BorderSide(color: ThemeColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  borderSide: BorderSide(color: ThemeColors.primary, width: 2),
                ),
                contentPadding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingMedium,
                  vertical: Dimensions.paddingSmall,
                ),
              ),
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          TextButton(
            onPressed: _handleCancel,
            child: Text(
              QyAppLocalizationKeys.qyCancel.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchOptions(WordControllerAppQy controller) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Row(
        children: [
          Expanded(
            child: _buildSearchOptionButton(
              QyAppLocalizationKeys.qyGeneralSearch.tr(context),
              controller.searchOption == 0,
              () => controller.setSearchOption(0),
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
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
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: Dimensions.paddingSmall,
          horizontal: Dimensions.paddingMedium,
        ),
        decoration: BoxDecoration(
          color: isSelected ? ThemeColors.primary : ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(
            color: isSelected ? ThemeColors.primary : ThemeColors.border,
          ),
        ),
        child: Center(
          child: Text(
            text,
            style: TextStyles.button.copyWith(
              color: isSelected ? ThemeColors.surface : ThemeColors.textPrimary,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
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
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      itemCount: controller.wordBooks.length,
      itemBuilder: (context, index) {
        final wordBook = controller.wordBooks[index];
        return _buildWordBookCard(wordBook);
      },
    );
  }

  Widget _buildWordBookCard(dynamic wordBook) {
    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  wordBook.name,
                  style: TextStyles.h4.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              IconButton(
                onPressed: () {},
                icon: Icon(
                  Icons.volume_up,
                  color: ThemeColors.primary,
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            wordBook.description,
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
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
          SizedBox(height: Dimensions.spacingMedium),
          ClipRRect(
            borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: wordBook.progress / 100,
              minHeight: 6,
              backgroundColor: ThemeColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
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
          style: TextStyles.caption.copyWith(
            color: ThemeColors.textTertiary,
          ),
        ),
        SizedBox(height: Dimensions.spacingXSmall),
        Text(
          value,
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.book_outlined,
            size: 64,
            color: ThemeColors.textTertiary.withOpacity(0.5),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyNoWordBooks.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
