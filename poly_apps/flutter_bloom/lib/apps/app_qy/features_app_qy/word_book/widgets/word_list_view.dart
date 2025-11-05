/// Word list view widget
library;

import 'package:flutter/material.dart';
import '../../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../../common/theme/app_theme.dart';
import '../../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../../../../../common/widgets/glassmorphism_card.dart';
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

    // Simulate API call
    await Future.delayed(const Duration(milliseconds: 500));

    // Mock data based on search query and word type
    List<WordItem> mockWords = _getMockWords();

    // Filter by search query
    if (widget.searchQuery.isNotEmpty) {
      mockWords = mockWords.where((word) {
        return word.word.toLowerCase().contains(widget.searchQuery.toLowerCase()) ||
               word.meaning.toLowerCase().contains(widget.searchQuery.toLowerCase());
      }).toList();
    }

    // Filter by word type
    if (widget.wordType != WordType.all) {
      mockWords = mockWords.where((word) => word.type == widget.wordType).toList();
    }

    setState(() {
      _words = mockWords;
      _isLoading = false;
    });
  }

  List<WordItem> _getMockWords() {
    return [
      WordItem(
        word: 'resilient',
        pronunciation: '/rɪˈzɪliənt/',
        meaning: '有弹性的；能迅速恢复的',
        example: 'She\'s a resilient person who bounces back from adversity.',
        type: WordType.learning,
        masteryLevel: 0.6,
      ),
      WordItem(
        word: 'paradigm',
        pronunciation: '/ˈpærədaɪm/',
        meaning: '范式；模式',
        example: 'The company is shifting its business paradigm.',
        type: WordType.learning,
        masteryLevel: 0.4,
      ),
      WordItem(
        word: 'ephemeral',
        pronunciation: '/ɪˈfemərəl/',
        meaning: '短暂的；瞬息的',
        example: 'The beauty of cherry blossoms is ephemeral.',
        type: WordType.newWords,
        masteryLevel: 0.1,
      ),
      WordItem(
        word: 'ubiquitous',
        pronunciation: '/juːˈbɪkwɪtəs/',
        meaning: '无处不在的；普遍存在的',
        example: 'Smartphones have become ubiquitous in modern society.',
        type: WordType.mastered,
        masteryLevel: 0.9,
      ),
      WordItem(
        word: 'meticulous',
        pronunciation: '/məˈtɪkjələs/',
        meaning: '一丝不苟的；小心翼翼的',
        example: 'She is meticulous in her research and documentation.',
        type: WordType.mastered,
        masteryLevel: 0.95,
      ),
      WordItem(
        word: 'serendipity',
        pronunciation: '/ˌserənˈdɪpəti/',
        meaning: '意外发现珍奇事物的运气；机缘巧合',
        example: 'It was pure serendipity that led to their discovery.',
        type: WordType.newWords,
        masteryLevel: 0.2,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryGreen),
            ),
            const SizedBox(height: 16),
            Text(
              'wordBook.loadingWords'.tr,
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    if (_words.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_off,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'wordBook.noWordsFound'.tr,
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 18,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadWords,
      color: AppTheme.primaryGreen,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: _words.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
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
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.8,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        builder: (context, scrollController) => GlassmorphismCard(
          child: Container(
            padding: const EdgeInsets.all(20),
            child: ListView(
              controller: scrollController,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        word.word,
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                Text(
                  word.pronunciation,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[600],
                    fontStyle: FontStyle.italic,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  word.meaning,
                  style: const TextStyle(
                    fontSize: 18,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyWordBookExampleSentence.tr(context),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryGreen,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        word.example,
                        style: const TextStyle(
                          fontSize: 16,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(context).pop();
                          _playPronunciation(word);
                        },
                        icon: const Icon(Icons.volume_up),
                        label: Text(QyAppLocalizationKeys.qyWordBookPronunciation.tr(context)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryGreen,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(context).pop();
                          _markAsLearned(word);
                        },
                        icon: const Icon(Icons.check),
                        label: Text(QyAppLocalizationKeys.qyWordBookMastered.tr(context)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.accentGreen,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showWordActions(WordItem word) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => GlassmorphismCard(
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.add_circle_outline, color: AppTheme.primaryGreen),
                title: Text('wordBook.addToNew'.tr),
                onTap: () {
                  Navigator.of(context).pop();
                  _addToNewWords(word);
                },
              ),
              ListTile(
                leading: const Icon(Icons.school_outlined, color: AppTheme.secondaryGreen),
                title: Text('wordBook.addToMastered'.tr),
                onTap: () {
                  Navigator.of(context).pop();
                  _markAsLearned(word);
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: Text('wordBook.removeFromBook'.tr),
                onTap: () {
                  Navigator.of(context).pop();
                  _removeFromBook(word);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _playPronunciation(WordItem word) {
    // TODO: Implement text-to-speech
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Playing pronunciation for ${word.word}'),
        backgroundColor: AppTheme.primaryGreen,
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
        content: Text('${word.word} marked as learned'),
        backgroundColor: AppTheme.accentGreen,
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
        content: Text('${word.word} added to new words'),
        backgroundColor: Colors.orange,
      ),
    );
  }

  void _removeFromBook(WordItem word) {
    setState(() {
      _words.remove(word);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${word.word} removed from word book'),
        backgroundColor: Colors.red,
      ),
    );
  }
}