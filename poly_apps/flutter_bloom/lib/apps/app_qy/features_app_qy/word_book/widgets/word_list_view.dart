/// Word list view widget
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/buttons/primary_button.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../data/word_book_data.dart';
import '../models/word_models.dart';
import 'word_item_card.dart';

class WordListView extends StatefulWidget {
  final String searchQuery;
  final WordType wordType;

  const WordListView({
    super.key,
    required this.searchQuery,
    required this.wordType,
  });

  @override
  State<WordListView> createState() => _WordListViewState();
}

class _WordListViewState extends State<WordListView> {
  bool _isLoading = false;
  List<WordItem> _words = [];

  @override
  void initState() {
    super.initState();
    _loadWords();
  }

  @override
  void didUpdateWidget(WordListView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.searchQuery != widget.searchQuery ||
        oldWidget.wordType != widget.wordType) {
      _loadWords();
    }
  }

  Future<void> _loadWords() async {
    setState(() {
      _isLoading = true;
    });

    await Future.delayed(const Duration(milliseconds: 250));

    final localization = LocalizationManager.of(context);
    final query = widget.searchQuery.trim().toLowerCase();

    List<WordItem> filtered = WordBookData.words;

    if (query.isNotEmpty) {
      filtered = filtered.where((word) {
        final meaning =
            localization.translate(word.meaningKey)?.toLowerCase() ?? '';
        return word.word.toLowerCase().contains(query) ||
            meaning.contains(query);
      }).toList();
    }

    if (widget.wordType != WordType.all) {
      filtered =
          filtered.where((word) => word.type == widget.wordType).toList();
    }

    setState(() {
      _words = filtered;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Center(
        child: GlassCard(
          borderRadius: ThemeDimensions.borderRadiusL,
          padding: EdgeInsets.all(ThemeDimensions.spacing24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                valueColor:
                    AlwaysStoppedAnimation<Color>(ColorsAppQy.qySecondary),
              ),
              SizedBox(height: ThemeDimensions.spacing12),
              Text(
                QyAppLocalizationKeys.qyWordBookLoading.tr(context),
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_words.isEmpty) {
      return Center(
        child: GlassCard(
          borderRadius: ThemeDimensions.borderRadiusXL,
          padding: EdgeInsets.all(ThemeDimensions.spacing24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.search_off,
                size: ThemeDimensions.iconSizeXXL,
                color: ColorsAppQy.qyBorderDark,
              ),
              SizedBox(height: ThemeDimensions.spacing12),
              Text(
                QyAppLocalizationKeys.qyWordBookNoWords.tr(context),
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadWords,
      color: ColorsAppQy.qyPrimary,
      child: ListView.builder(
        padding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.spacing16,
          vertical: ThemeDimensions.spacing12,
        ),
        itemCount: _words.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: EdgeInsets.only(bottom: ThemeDimensions.spacing12),
            child: WordItemCard(
              word: _words[index],
              onTap: () => _showWordDetail(_words[index]),
              onAction: () => _showWordActions(_words[index]),
            ),
          );
        },
      ),
    );
  }

  void _showWordDetail(WordItem word) {
    showModalBottomSheet(
      context: context,
      backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        minChildSize: 0.6,
        builder: (context, controller) => GlassCard(
          borderRadius: ThemeDimensions.borderRadiusXL,
          padding: EdgeInsets.all(ThemeDimensions.spacing24),
          child: ListView(
            controller: controller,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      word.word,
                      style: ThemeTextStyles.headlineMedium.copyWith(
                        fontWeight: FontWeight.bold,
                        color: ColorsAppQy.qyTextPrimary,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              SizedBox(height: ThemeDimensions.spacing8),
              Text(
                word.pronunciation,
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                  fontStyle: FontStyle.italic,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing16),
              Text(
                word.meaningKey.tr(context),
                style: ThemeTextStyles.headlineSmall.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing16),
              Container(
                padding: EdgeInsets.all(ThemeDimensions.spacing16),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyPrimary.withOpacity(0.08),
                  borderRadius: ThemeDimensions.borderRadiusL,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      QyAppLocalizationKeys.qyWordBookExampleSentence
                          .tr(context),
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: ColorsAppQy.qyPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.spacing8),
                    Text(
                      word.exampleKey.tr(context),
                      style: ThemeTextStyles.bodyLarge.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing24),
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      text: QyAppLocalizationKeys.qyWordBookPronunciation
                          .tr(context),
                      icon: Icons.volume_up,
                      onPressed: () {
                        Navigator.of(context).pop();
                        _playPronunciation(word);
                      },
                      backgroundColor: ColorsAppQy.qySecondary,
                    ),
                  ),
                  SizedBox(width: ThemeDimensions.spacing12),
                  Expanded(
                    child: PrimaryButton(
                      text:
                          QyAppLocalizationKeys.qyWordBookMastered.tr(context),
                      icon: Icons.check,
                      onPressed: () {
                        Navigator.of(context).pop();
                        _markAsLearned(word);
                      },
                      backgroundColor: ColorsAppQy.qyPrimary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showWordActions(WordItem word) {
    showModalBottomSheet(
      context: context,
      backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
      builder: (context) => GlassCard(
        borderRadius: ThemeDimensions.borderRadiusL,
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildActionTile(
              icon: Icons.add_circle_outline,
              color: ColorsAppQy.qySecondary,
              label: QyAppLocalizationKeys.qyWordBookAddToNew.tr(context),
              onTap: () {
                Navigator.of(context).pop();
                _addToNewWords(word);
              },
            ),
            _buildActionTile(
              icon: Icons.school_outlined,
              color: ColorsAppQy.qyPrimary,
              label: QyAppLocalizationKeys.qyWordBookAddToMastered.tr(context),
              onTap: () {
                Navigator.of(context).pop();
                _markAsLearned(word);
              },
            ),
            _buildActionTile(
              icon: Icons.delete_outline,
              color: ColorsAppQy.qyError,
              label: QyAppLocalizationKeys.qyWordBookRemoveFromBook.tr(context),
              onTap: () {
                Navigator.of(context).pop();
                _removeFromBook(word);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required Color color,
    required String label,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(
        label,
        style: ThemeTextStyles.bodyMedium.copyWith(
          color: ColorsAppQy.qyTextPrimary,
        ),
      ),
      onTap: onTap,
    );
  }

  void _playPronunciation(WordItem word) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          QyAppLocalizationKeys.qyWordBookSnackPlay
              .tr(context)
              .replaceAll('{word}', word.word),
        ),
        backgroundColor: ColorsAppQy.qySecondary,
      ),
    );
  }

  void _markAsLearned(WordItem word) {
    setState(() {
      word.type = WordType.mastered;
      word.masteryLevel = 1.0;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          QyAppLocalizationKeys.qyWordBookSnackLearned
              .tr(context)
              .replaceAll('{word}', word.word),
        ),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _addToNewWords(WordItem word) {
    setState(() {
      word.type = WordType.newWords;
      word.masteryLevel = 0.0;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          QyAppLocalizationKeys.qyWordBookSnackAdded
              .tr(context)
              .replaceAll('{word}', word.word),
        ),
        backgroundColor: ColorsAppQy.qyAccent,
      ),
    );
  }

  void _removeFromBook(WordItem word) {
    setState(() {
      _words.remove(word);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          QyAppLocalizationKeys.qyWordBookSnackRemoved
              .tr(context)
              .replaceAll('{word}', word.word),
        ),
        backgroundColor: ColorsAppQy.qyError,
      ),
    );
  }
}
