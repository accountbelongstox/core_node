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
    extends State<WordListeningScreenRefactoredAppQy> {
  int _selectedMode;
  final List<Map<String, dynamic>> _listeningModes;

  _WordListeningScreenRefactoredAppQyState()
      : _selectedMode = 0,
        _listeningModes = [];

  @override
  void initState() {
    super.initState();
    _initListeningModes();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WordControllerAppQy>().loadWordBooks();
    });
  }

  void _initListeningModes() {
    _listeningModes.addAll([
      {
        'icon': Icons.menu_book,
        'title': 'qyWordBook',
        'count': 200,
      },
      {
        'icon': Icons.bookmark,
        'title': 'qyMyVocabulary',
        'count': 27,
      },
      {
        'icon': Icons.fiber_new,
        'title': 'qyTodayNewWords',
        'count': 200,
      },
      {
        'icon': Icons.refresh,
        'title': 'qyTodayReview',
        'count': 27,
      },
      {
        'icon': Icons.list,
        'title': 'qyAllWords',
        'count': 16952,
      },
      {
        'icon': Icons.pending,
        'title': 'qyUnlearnedWords',
        'count': 16925,
      },
      {
        'icon': Icons.school,
        'title': 'qyLearningWords',
        'count': 27,
      },
      {
        'icon': Icons.star,
        'title': 'qySimpleWords',
        'count': 0,
      },
    ]);
  }

  void _handleModeSelect(int index) {
    setState(() {
      _selectedMode = index;
    });
  }

  void _handleStartListening() {
    final mode = _listeningModes[_selectedMode];
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyStarting.tr(context)} ${QyAppLocalizationKeys.values[mode['title']].tr(context)}',
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
        actions: [
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.settings, color: ThemeColors.textPrimary),
          ),
        ],
      ),
      body: Consumer<WordControllerAppQy>(
        builder: (context, controller, child) {
          return SafeArea(
            child: Column(
              children: [
                _buildModeSelector(),
                Expanded(
                  child: controller.isLoading
                      ? Center(
                          child: CircularProgressIndicator(
                            color: ThemeColors.primary,
                          ),
                        )
                      : _buildModesList(),
                ),
                _buildStartButton(),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildModeSelector() {
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
            child: _buildModeSelectorButton(
              QyAppLocalizationKeys.qyWordBook.tr(context),
              true,
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Container(
            width: 4,
            height: 4,
            decoration: BoxDecoration(
              color: ThemeColors.textTertiary,
              shape: BoxShape.circle,
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Expanded(
            child: _buildModeSelectorButton(
              QyAppLocalizationKeys.qyTodayNewWords.tr(context),
              false,
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Icon(
            Icons.keyboard_arrow_down,
            color: ThemeColors.textSecondary,
          ),
        ],
      ),
    );
  }

  Widget _buildModeSelectorButton(String text, bool isActive) {
    return Text(
      text,
      style: TextStyles.body1.copyWith(
        color: isActive ? ThemeColors.textPrimary : ThemeColors.textSecondary,
        fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
      ),
      textAlign: TextAlign.center,
    );
  }

  Widget _buildModesList() {
    return GridView.builder(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: Dimensions.spacingMedium,
        mainAxisSpacing: Dimensions.spacingMedium,
        childAspectRatio: 1.2,
      ),
      itemCount: _listeningModes.length,
      itemBuilder: (context, index) {
        return _buildModeCard(index);
      },
    );
  }

  Widget _buildModeCard(int index) {
    final mode = _listeningModes[index];
    final isSelected = _selectedMode == index;

    return InkWell(
      onTap: () => _handleModeSelect(index),
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(
            color: isSelected ? ThemeColors.primary : ThemeColors.border,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: ThemeColors.primary.withOpacity(0.2),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: EdgeInsets.all(Dimensions.paddingSmall),
              decoration: BoxDecoration(
                color: (isSelected ? ThemeColors.primary : ThemeColors.textSecondary)
                    .withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                mode['icon'] as IconData,
                size: 32,
                color: isSelected ? ThemeColors.primary : ThemeColors.textSecondary,
              ),
            ),
            SizedBox(height: Dimensions.spacingMedium),
            Text(
              QyAppLocalizationKeys.values[mode['title']].tr(context),
              style: TextStyles.body2.copyWith(
                color: isSelected ? ThemeColors.primary : ThemeColors.textPrimary,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: Dimensions.spacingSmall),
            Text(
              mode['count'].toString(),
              style: TextStyles.h3.copyWith(
                color: isSelected ? ThemeColors.primary : ThemeColors.textSecondary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStartButton() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          top: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _handleStartListening,
          style: ElevatedButton.styleFrom(
            backgroundColor: ThemeColors.primary,
            padding: EdgeInsets.symmetric(vertical: Dimensions.paddingMedium),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            ),
            elevation: 2,
          ),
          child: Text(
            QyAppLocalizationKeys.qyStartListening.tr(context),
            style: TextStyles.button.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
}
