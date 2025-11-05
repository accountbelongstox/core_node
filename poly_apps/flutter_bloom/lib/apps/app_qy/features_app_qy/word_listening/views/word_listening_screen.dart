/// Word Listening screen with audio playback functionality
library;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/gradient_button.dart';
import 'widgets/category_list.dart';
import 'widgets/playback_controls.dart';
import 'widgets/current_word_card.dart';

class WordListeningScreen extends StatefulWidget {
  const WordListeningScreen({super.key});

  @override
  State<WordListeningScreen> createState() => _WordListeningScreenState();
}

class _WordListeningScreenState extends State<WordListeningScreen>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  ListeningCategory _selectedCategory = ListeningCategory.todayNew;
  bool _isPlaying = false;
  double _playbackSpeed = 1.0;
  bool _isLooping = false;
  bool _isShuffling = false;
  int _currentIndex = 0;
  List<WordAudioItem> _currentWords = [];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    );
    _loadWordsForCategory(_selectedCategory);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryGreen.withOpacity(0.1),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              const SizedBox(height: 16),
              _buildCategorySelector(),
              const SizedBox(height: 20),
              const CurrentWordCard(),
              const SizedBox(height: 20),
              PlaybackControls(
                isPlaying: _isPlaying,
                currentIndex: _currentIndex,
                totalWords: _currentWords.length,
                playbackSpeed: _playbackSpeed,
                isLooping: _isLooping,
                isShuffling: _isShuffling,
                onPlayPause: _togglePlayPause,
                onPrevious: _playPrevious,
                onNext: _playNext,
                onSpeedChanged: _changeSpeed,
                onLoopChanged: _toggleLoop,
                onShuffleChanged: _toggleShuffle,
              ),
              const Spacer(),
              _buildBottomStats(),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: AppTheme.textPrimary),
            onPressed: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: Text(
              'wordListening.title'.tr,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.queue_music, color: AppTheme.textPrimary),
            onPressed: _showPlaylistDialog,
          ),
          IconButton(
            icon: const Icon(Icons.settings, color: AppTheme.textPrimary),
            onPressed: _showSettingsDialog,
          ),
        ],
      ),
    );
  }

  Widget _buildCategorySelector() {
    return Container(
      height: 120,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: CategoryList(
        selectedCategory: _selectedCategory,
        onCategorySelected: (category) {
          setState(() {
            _selectedCategory = category;
            _currentIndex = 0;
            _isPlaying = false;
          });
          _loadWordsForCategory(category);
        },
      ),
    );
  }

  Widget _buildBottomStats() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppTheme.primaryGreen.withOpacity(0.1),
            AppTheme.secondaryGreen.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildStatItem(
              Icons.headphones,
              'wordListening.currentProgress'.tr,
              '${_currentIndex + 1}/${_currentWords.length}',
              AppTheme.primaryGreen,
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.grey.shade300,
          ),
          Expanded(
            child: _buildStatItem(
              Icons.speed,
              'wordListening.speed'.tr,
              '${_playbackSpeed}x',
              AppTheme.secondaryGreen,
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.grey.shade300,
          ),
          Expanded(
            child: _buildStatItem(
              Icons.loop,
              'wordListening.loop'.tr,
              _isLooping ? '开启' : '关闭',
              _isLooping ? AppTheme.accentGreen : Colors.grey,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(IconData icon, String label, String value, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: Colors.grey[600],
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  void _loadWordsForCategory(ListeningCategory category) {
    // Mock data for different categories
    setState(() {
      switch (category) {
        case ListeningCategory.wordBook:
          _currentWords = _getMockWordBookWords();
          break;
        case ListeningCategory.newWords:
          _currentWords = _getMockNewWords();
          break;
        case ListeningCategory.todayNew:
          _currentWords = _getMockTodayNewWords();
          break;
        case ListeningCategory.todayReview:
          _currentWords = _getMockTodayReviewWords();
          break;
        case ListeningCategory.fullList:
          _currentWords = _getMockFullListWords();
          break;
        case ListeningCategory.fullUnlearned:
          _currentWords = _getMockFullUnlearnedWords();
          break;
        case ListeningCategory.fullLearning:
          _currentWords = _getMockFullLearningWords();
          break;
        case ListeningCategory.fullSimple:
          _currentWords = _getMockFullSimpleWords();
          break;
      }
    });
  }

  List<WordAudioItem> _getMockTodayNewWords() {
    return [
      WordAudioItem(
        word: 'resilient',
        pronunciation: '/rɪˈzɪliənt/',
        meaning: '有弹性的；能迅速恢复的',
        example: 'She\'s a resilient person who bounces back from adversity.',
      ),
      WordAudioItem(
        word: 'paradigm',
        pronunciation: '/ˈpærədaɪm/',
        meaning: '范式；模式',
        example: 'The company is shifting its business paradigm.',
      ),
      WordAudioItem(
        word: 'ephemeral',
        pronunciation: '/ɪˈfemərəl/',
        meaning: '短暂的；瞬息的',
        example: 'The beauty of cherry blossoms is ephemeral.',
      ),
    ];
  }

  List<WordAudioItem> _getMockTodayReviewWords() {
    return [
      WordAudioItem(
        word: 'ubiquitous',
        pronunciation: '/juːˈbɪkwɪtəs/',
        meaning: '无处不在的；普遍存在的',
        example: 'Smartphones have become ubiquitous in modern society.',
      ),
      WordAudioItem(
        word: 'meticulous',
        pronunciation: '/məˈtɪkjələs/',
        meaning: '一丝不苟的；小心翼翼的',
        example: 'She is meticulous in her research and documentation.',
      ),
    ];
  }

  List<WordAudioItem> _getMockWordBookWords() {
    return [
      WordAudioItem(
        word: 'resilient',
        pronunciation: '/rɪˈzɪliənt/',
        meaning: '有弹性的；能迅速恢复的',
        example: 'She\'s a resilient person who bounces back from adversity.',
      ),
    ];
  }

  List<WordAudioItem> _getMockNewWords() {
    return [
      WordAudioItem(
        word: 'serendipity',
        pronunciation: '/ˌserənˈdɪpəti/',
        meaning: '意外发现珍奇事物的运气；机缘巧合',
        example: 'It was pure serendipity that led to their discovery.',
      ),
    ];
  }

  List<WordAudioItem> _getMockFullListWords() {
    return _getMockTodayNewWords() + _getMockTodayReviewWords();
  }

  List<WordAudioItem> _getMockFullUnlearnedWords() {
    return [
      WordAudioItem(
        word: 'ephemeral',
        pronunciation: '/ɪˈfemərəl/',
        meaning: '短暂的；瞬息的',
        example: 'The beauty of cherry blossoms is ephemeral.',
      ),
    ];
  }

  List<WordAudioItem> _getMockFullLearningWords() {
    return [
      WordAudioItem(
        word: 'resilient',
        pronunciation: '/rɪˈzɪliənt/',
        meaning: '有弹性的；能迅速恢复的',
        example: 'She\'s a resilient person who bounces back from adversity.',
      ),
    ];
  }

  List<WordAudioItem> _getMockFullSimpleWords() {
    return [
      WordAudioItem(
        word: 'simple',
        pronunciation: '/ˈsɪmpl/',
        meaning: '简单的；朴素的',
        example: 'The solution is quite simple.',
      ),
    ];
  }

  void _togglePlayPause() {
    setState(() {
      _isPlaying = !_isPlaying;
    });
    if (_isPlaying) {
      _pulseController.repeat();
      _startPlayback();
    } else {
      _pulseController.stop();
      _pausePlayback();
    }
  }

  void _playPrevious() {
    if (_currentIndex > 0) {
      setState(() {
        _currentIndex--;
      });
    }
  }

  void _playNext() {
    if (_currentIndex < _currentWords.length - 1) {
      setState(() {
        _currentIndex++;
      });
    } else if (_isLooping) {
      setState(() {
        _currentIndex = 0;
      });
    }
  }

  void _changeSpeed(double speed) {
    setState(() {
      _playbackSpeed = speed;
    });
  }

  void _toggleLoop() {
    setState(() {
      _isLooping = !_isLooping;
    });
  }

  void _toggleShuffle() {
    setState(() {
      _isShuffling = !_isShuffling;
      if (_isShuffling) {
        _currentWords.shuffle();
        _currentIndex = 0;
      }
    });
  }

  void _startPlayback() {
    // TODO: Implement audio playback
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${'wordListening.playing'.tr}: ${_currentWords[_currentIndex].word}'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _pausePlayback() {
    // TODO: Implement audio pause
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('wordListening.paused'.tr),
        backgroundColor: Colors.orange,
      ),
    );
  }

  void _showPlaylistDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        builder: (context, scrollController) => GlassmorphismCard(
          child: Container(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '播放列表',
                        style: const TextStyle(
                          fontSize: 20,
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
                const SizedBox(height: 16),
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: _currentWords.length,
                    itemBuilder: (context, index) {
                      final word = _currentWords[index];
                      final isCurrentWord = index == _currentIndex;
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isCurrentWord
                              ? AppTheme.primaryGreen
                              : Colors.grey.shade300,
                          child: Text(
                            '${index + 1}',
                            style: TextStyle(
                              color: isCurrentWord ? Colors.white : Colors.grey[600],
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        title: Text(
                          word.word,
                          style: TextStyle(
                            fontWeight: isCurrentWord ? FontWeight.bold : FontWeight.normal,
                            color: isCurrentWord ? AppTheme.primaryGreen : AppTheme.textPrimary,
                          ),
                        ),
                        subtitle: Text(word.meaning),
                        trailing: isCurrentWord
                            ? Icon(Icons.play_arrow, color: AppTheme.primaryGreen)
                            : null,
                        onTap: () {
                          setState(() {
                            _currentIndex = index;
                          });
                          Navigator.of(context).pop();
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showSettingsDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => GlassmorphismCard(
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'wordListening.playMode'.tr,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Icon(Icons.speed, color: AppTheme.primaryGreen),
                title: Text('wordListening.speed'.tr),
                trailing: DropdownButton<double>(
                  value: _playbackSpeed,
                  items: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
                      .map((speed) => DropdownMenuItem(
                            value: speed,
                            child: Text('${speed}x'),
                          ))
                      .toList(),
                  onChanged: (value) {
                    if (value != null) {
                      _changeSpeed(value);
                      Navigator.of(context).pop();
                    }
                  },
                ),
              ),
              SwitchListTile(
                value: _isLooping,
                onChanged: (value) {
                  _toggleLoop();
                  Navigator.of(context).pop();
                },
                title: Text('wordListening.loop'.tr),
                secondary: Icon(
                  Icons.loop,
                  color: _isLooping ? AppTheme.accentGreen : Colors.grey,
                ),
              ),
              SwitchListTile(
                value: _isShuffling,
                onChanged: (value) {
                  _toggleShuffle();
                  Navigator.of(context).pop();
                },
                title: Text('wordListening.shufflePlay'.tr),
                secondary: Icon(
                  Icons.shuffle,
                  color: _isShuffling ? AppTheme.primaryGreen : Colors.grey,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum ListeningCategory {
  wordBook,
  newWords,
  todayNew,
  todayReview,
  fullList,
  fullUnlearned,
  fullLearning,
  fullSimple,
}

class WordAudioItem {
  final String word;
  final String pronunciation;
  final String meaning;
  final String example;

  WordAudioItem({
    required this.word,
    required this.pronunciation,
    required this.meaning,
    required this.example,
  });
}