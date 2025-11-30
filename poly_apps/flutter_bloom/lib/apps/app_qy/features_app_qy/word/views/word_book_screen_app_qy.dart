// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Word Book Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordBookScreenAppQy extends StatefulWidget {
  const WordBookScreenAppQy({super.key});

  @override
  State<WordBookScreenAppQy> createState() => _WordBookScreenAppQyState();
}

class _WordBookScreenAppQyState extends State<WordBookScreenAppQy> {
  final TextEditingController _searchController;
  bool _isGeneralSearch;
  final List<Map<String, dynamic>> _wordList;

  _WordBookScreenAppQyState()
      : _searchController = TextEditingController(),
        _isGeneralSearch = true,
        _wordList = [];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _handleSearch(String query) {
    // TODO: Implement search functionality
  }

  void _handleCancel() {
    setState(() {
      _searchController.clear();
    });
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
      body: SafeArea(
        child: Column(
          children: [
            _buildSearchSection(),
            _buildSearchOptions(),
            Expanded(
              child: _buildSearchResults(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchSection() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.1),
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
                hintText: '查询 | 英文或中文',
                hintStyle: TextStyles.body2.copyWith(color: ThemeColors.textTertiary),
                prefixIcon: Icon(Icons.search, color: ThemeColors.textSecondary),
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

  Widget _buildSearchOptions() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Row(
        children: [
          Expanded(
            child: _buildSearchOptionButton(
              '通用搜索',
              _isGeneralSearch,
              () {
                setState(() {
                  _isGeneralSearch = true;
                });
              },
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Expanded(
            child: _buildSearchOptionButton(
              '单词书内搜',
              !_isGeneralSearch,
              () {
                setState(() {
                  _isGeneralSearch = false;
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchOptionButton(String text, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
        decoration: BoxDecoration(
          color: isSelected ? ThemeColors.primary : ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(
            color: isSelected ? ThemeColors.primary : ThemeColors.border,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Center(
          child: Text(
            text,
            style: TextStyles.button.copyWith(
              color: isSelected ? ThemeColors.onPrimary : ThemeColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchResults() {
    if (_searchController.text.isEmpty) {
      return _buildEmptyState();
    }

    if (_wordList.isEmpty) {
      return _buildNoResultsState();
    }

    return ListView.builder(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      itemCount: _wordList.length,
      itemBuilder: (context, index) {
        final word = _wordList[index];
        return _buildWordItem(word);
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.search,
            size: 64,
            color: ThemeColors.textTertiary.withOpacity(0.5),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qySearchPlaceholder.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoResultsState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.sentiment_dissatisfied,
            size: 64,
            color: ThemeColors.textTertiary.withOpacity(0.5),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyNoResults.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWordItem(Map<String, dynamic> word) {
    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingSmall),
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  word['word'] ?? '',
                  style: TextStyles.h4.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              IconButton(
                icon: Icon(Icons.volume_up, color: ThemeColors.primary),
                onPressed: () {
                  // TODO: Play pronunciation
                },
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingXSmall),
          Text(
            word['translation'] ?? '',
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
