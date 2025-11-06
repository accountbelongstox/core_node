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

/// Refactored Word Listening Screen for QY App - with proper architecture
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/word_controller_app_qy.dart';

class WordListeningScreenRefactoredAppQy extends StatefulWidget {
  const WordListeningScreenRefactoredAppQy({super.key});

  @override
  State<WordListeningScreenRefactoredAppQy> createState() =>
      _WordListeningScreenRefactoredAppQyState();
}

class _WordListeningScreenRefactoredAppQyState
    extends State<WordListeningScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int _selectedTab;
  int _selectedCategory;
  final List<Map<String, dynamic>> _wordCategories;

  _WordListeningScreenRefactoredAppQyState()
      : _selectedTab = 0,
        _selectedCategory = 0,
        _wordCategories = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) {
        setState(() {
          _selectedTab = _tabController.index;
        });
      }
    });
    _initWordCategories();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WordControllerAppQy>().loadWordBooks();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _initWordCategories() {
    _wordCategories.addAll([
      {'label': 'qyWordTodayNew', 'count': 200},
      {'label': 'qyWordTodayReview', 'count': 27},
      {'label': 'qyWordAllList', 'count': 16952},
      {'label': 'qyWordNotLearned', 'count': 16925},
      {'label': 'qyWordLearning', 'count': 27},
      {'label': 'qyWordSimple', 'count': 0},
    ]);
  }

  void _handleCategorySelect(int index) {
    setState(() {
      _selectedCategory = index;
    });
  }

  void _handleStartListening() {
    final category = _wordCategories[_selectedCategory];
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyStarting.tr(context)} ${category['label'].toString().tr(context)}',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyWordListening.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: Consumer<WordControllerAppQy>(
        builder: (context, controller, child) {
          return Column(
            children: [
              _buildWordBookSelector(),
              _buildWordBookCard(),
              Expanded(
                child: _buildCategoriesList(),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildWordBookSelector() {
    return Container(
      margin: EdgeInsets.all(Dimensions.paddingMedium),
      padding: EdgeInsets.symmetric(
        horizontal: Dimensions.paddingMedium,
        vertical: Dimensions.paddingSmall,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.surface.withOpacity(0.5),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            QyAppLocalizationKeys.qyWordWordBook.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Text(
            '•',
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyWordTodayNew.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Icon(
            Icons.arrow_drop_down,
            color: ThemeColors.textSecondary,
            size: 24,
          ),
        ],
      ),
    );
  }

  Widget _buildWordBookCard() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: Dimensions.paddingMedium),
      height: 220,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        child: Stack(
          children: [
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    ThemeColors.primary.withOpacity(0.3),
                    ThemeColors.secondary.withOpacity(0.2),
                  ],
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.book,
                      size: 64,
                      color: ThemeColors.primary.withOpacity(0.5),
                    ),
                    SizedBox(height: Dimensions.spacingMedium),
                    Text(
                      'Word Book',
                      style: TextStyles.h4.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                decoration: BoxDecoration(
                  color: ThemeColors.surface.withOpacity(0.95),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(Dimensions.radiusLarge),
                    bottomRight: Radius.circular(Dimensions.radiusLarge),
                  ),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicatorColor: ThemeColors.primary,
                  indicatorWeight: 3,
                  labelColor: ThemeColors.primary,
                  unselectedLabelColor: ThemeColors.textSecondary,
                  labelStyle: TextStyles.body1.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  unselectedLabelStyle: TextStyles.body1,
                  tabs: [
                    Tab(text: QyAppLocalizationKeys.qyWordWordBook.tr(context)),
                    Tab(
                        text: QyAppLocalizationKeys.qyWordNewWordBook
                            .tr(context)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoriesList() {
    return Container(
      margin: EdgeInsets.only(top: Dimensions.spacingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(Dimensions.radiusXLarge),
          topRight: Radius.circular(Dimensions.radiusXLarge),
        ),
      ),
      child: ListView.separated(
        padding: EdgeInsets.all(Dimensions.paddingLarge),
        itemCount: _wordCategories.length,
        separatorBuilder: (context, index) =>
            SizedBox(height: Dimensions.spacingSmall),
        itemBuilder: (context, index) {
          return _buildCategoryItem(index);
        },
      ),
    );
  }

  Widget _buildCategoryItem(int index) {
    final category = _wordCategories[index];
    final isSelected = _selectedCategory == index;
    final count = category['count'] as int;
    final labelKey = category['label'] as String;

    return InkWell(
      onTap: () => _handleCategorySelect(index),
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: isSelected
              ? ThemeColors.primary.withOpacity(0.05)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(
            color: isSelected
                ? ThemeColors.primary.withOpacity(0.3)
                : ThemeColors.border,
            width: 1,
          ),
        ),
        child: Row(
          children: [
            if (isSelected)
              Icon(
                Icons.check_circle,
                color: ThemeColors.primary,
                size: 20,
              )
            else
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: ThemeColors.border,
                    width: 2,
                  ),
                ),
              ),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: Text(
                labelKey.tr(context),
                style: TextStyles.body1.copyWith(
                  color: isSelected
                      ? ThemeColors.primary
                      : ThemeColors.textPrimary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            Text(
              count.toString(),
              style: TextStyles.h4.copyWith(
                color: isSelected
                    ? ThemeColors.primary
                    : ThemeColors.textSecondary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
