/// Word Listening screen with audio playback functionality
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, bento box layout
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';
import 'widgets/category_list.dart';
import 'widgets/playback_controls.dart';
import 'widgets/current_word_card.dart';
import '../models/word_audio_model.dart';
import '../data/word_audio_data.dart';

class WordListeningScreen extends StatefulWidget {
  const WordListeningScreen({super.key});

  @override
  State<WordListeningScreen> createState() => _WordListeningScreenState();
}

class _WordListeningScreenState extends State<WordListeningScreen>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _shimmerController;
  late Animation<double> _shimmerAnimation;

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
      duration: Duration(milliseconds: ThemeDimensions.animationDurationNormal),
      vsync: this,
    );
    _shimmerController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();
    _shimmerAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _shimmerController,
        curve: Curves.easeInOut,
      ),
    );
    _loadWordsForCategory(_selectedCategory);
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final storage = StorageAppQy.instance;
    final settings =
        await storage.getApp<Map<String, dynamic>>('word_listening_settings');
    if (mounted && settings != null) {
      setState(() {
        if (settings['speed'] != null)
          _playbackSpeed = (settings['speed'] as num).toDouble();
        if (settings['looping'] != null)
          _isLooping = settings['looping'] as bool;
        if (settings['shuffling'] != null)
          _isShuffling = settings['shuffling'] as bool;
      });
    }
  }

  Future<void> _saveSettings() async {
    final storage = StorageAppQy.instance;
    await storage.setApp<Map<String, dynamic>>('word_listening_settings', {
      'speed': _playbackSpeed,
      'looping': _isLooping,
      'shuffling': _isShuffling,
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: _shimmerAnimation,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient:
                  ColorsAppQy.qyDynamicShimmerGradient(_shimmerAnimation.value),
            ),
            child: SafeArea(
              child: FadeTransition(
                opacity: Tween<double>(begin: 0.0, end: 1.0).animate(
                  CurvedAnimation(
                      parent: _pulseController, curve: Curves.easeIn),
                ),
                child: Column(
                  children: [
                    _buildAppBar(context),
                    SizedBox(height: ThemeDimensions.spacing16),
                    _buildCategorySelector(),
                    SizedBox(height: ThemeDimensions.spacing20),
                    Expanded(
                      child: _buildBentoBoxContent(context),
                    ),
                    SizedBox(height: ThemeDimensions.spacing20),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildBentoBoxContent(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        children: [
          _buildBentoGrid(context),
        ],
      ),
    );
  }

  Widget _buildBentoGrid(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              flex: 2,
              child: CurrentWordCard(
                word: _currentWords.isNotEmpty
                    ? _currentWords[_currentIndex].word
                    : '',
                phonetic: _currentWords.isNotEmpty
                    ? _currentWords[_currentIndex].pronunciation
                    : '',
                translation: _currentWords.isNotEmpty
                    ? _currentWords[_currentIndex].meaningKey.tr(context)
                    : '',
                example: _currentWords.isNotEmpty
                    ? _currentWords[_currentIndex].exampleKey.tr(context)
                    : null,
              ),
            ),
            SizedBox(width: ThemeDimensions.spacing16),
            Expanded(
              flex: 1,
              child: GlassCard(
                child: _buildStatsCard(context),
                borderRadius: ThemeDimensions.borderRadiusM,
              ),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        GlassCard(
          child: PlaybackControls(
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
          borderRadius: ThemeDimensions.borderRadiusL,
        ),
      ],
    );
  }

  Widget _buildStatsCard(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.headphones,
            color: ColorsAppQy.qyPrimary,
            size: ThemeDimensions.iconSizeL,
          ),
          SizedBox(height: ThemeDimensions.spacing8),
          Text(
            '${_currentIndex + 1}/${_currentWords.length}',
            style: ThemeTextStyles.headlineMedium.copyWith(
              color: ColorsAppQy.qyTextPrimary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacing4),
          Text(
            QyAppLocalizationKeys.qyListeningProgress.tr(context),
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing12,
      ),
      child: Row(
        children: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Icon(
              Icons.arrow_back,
              color: ColorsAppQy.qyTextPrimary,
              size: ThemeDimensions.iconSizeM,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacing8),
          Expanded(
            child: Text(
              QyAppLocalizationKeys.qyWordListening.tr(context),
              style: ThemeTextStyles.headlineSmall.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          BouncingButton(
            onPressed: _showPlaylistDialog,
            child: Icon(
              Icons.queue_music,
              color: ColorsAppQy.qyTextPrimary,
              size: ThemeDimensions.iconSizeM,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacing8),
          BouncingButton(
            onPressed: _showSettingsDialog,
            child: Icon(
              Icons.settings,
              color: ColorsAppQy.qyTextPrimary,
              size: ThemeDimensions.iconSizeM,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategorySelector() {
    return Container(
      height: 120,
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      child: GlassCard(
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
        borderRadius: ThemeDimensions.borderRadiusM,
      ),
    );
  }

  void _loadWordsForCategory(ListeningCategory category) {
    setState(() {
      switch (category) {
        case ListeningCategory.wordBook:
          _currentWords = WordAudioData.getWordBookWords();
          break;
        case ListeningCategory.newWords:
          _currentWords = WordAudioData.getNewWords();
          break;
        case ListeningCategory.todayNew:
          _currentWords = WordAudioData.getTodayNewWords();
          break;
        case ListeningCategory.todayReview:
          _currentWords = WordAudioData.getTodayReviewWords();
          break;
        case ListeningCategory.fullList:
          _currentWords = WordAudioData.getFullListWords();
          break;
        case ListeningCategory.fullUnlearned:
          _currentWords = WordAudioData.getFullUnlearnedWords();
          break;
        case ListeningCategory.fullLearning:
          _currentWords = WordAudioData.getFullLearningWords();
          break;
        case ListeningCategory.fullSimple:
          _currentWords = WordAudioData.getFullSimpleWords();
          break;
      }
    });
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
    _saveSettings();
  }

  void _toggleLoop() {
    setState(() {
      _isLooping = !_isLooping;
    });
    _saveSettings();
  }

  void _toggleShuffle() {
    setState(() {
      _isShuffling = !_isShuffling;
      if (_isShuffling) {
        _currentWords.shuffle();
        _currentIndex = 0;
      }
    });
    _saveSettings();
  }

  void _startPlayback() {
    // TODO: Implement audio playback
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
            '${QyAppLocalizationKeys.qyListeningPlaying.tr(context)}: ${_currentWords[_currentIndex].word}'),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _pausePlayback() {
    // TODO: Implement audio pause
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningPaused.tr(context)),
        backgroundColor: ColorsAppQy.qyWarning,
      ),
    );
  }

  void _showPlaylistDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        builder: (context, scrollController) => GlassCard(
          child: Container(
            padding: EdgeInsets.all(ThemeDimensions.spacing20),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        QyAppLocalizationKeys.qyListeningPlaylist.tr(context),
                        style: ThemeTextStyles.headlineSmall.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    BouncingButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Icon(
                        Icons.close,
                        color: ColorsAppQy.qyTextPrimary,
                        size: ThemeDimensions.iconSizeM,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: ThemeDimensions.spacing16),
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
                              ? ColorsAppQy.qyPrimary
                              : ColorsAppQy.qyHolographicMedium,
                          child: Text(
                            '${index + 1}',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: isCurrentWord
                                  ? ColorsAppQy.qyTextOnPrimary
                                  : ColorsAppQy.qyTextSecondary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        title: Text(
                          word.word,
                          style: ThemeTextStyles.bodyLarge.copyWith(
                            fontWeight: isCurrentWord
                                ? FontWeight.bold
                                : FontWeight.normal,
                            color: isCurrentWord
                                ? ColorsAppQy.qyPrimary
                                : ColorsAppQy.qyTextPrimary,
                          ),
                        ),
                        subtitle: Text(
                          word.meaningKey.tr(context),
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        trailing: isCurrentWord
                            ? Icon(Icons.play_arrow,
                                color: ColorsAppQy.qyPrimary)
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
          borderRadius: ThemeDimensions.borderRadiusL,
        ),
      ),
    );
  }

  void _showSettingsDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: ColorsAppQy.qyPageBackground.withOpacity(0),
      builder: (context) => GlassCard(
        child: Container(
          padding: EdgeInsets.all(ThemeDimensions.spacing20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningSettings.tr(context),
                style: ThemeTextStyles.headlineSmall.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing16),
              ListTile(
                leading: Icon(Icons.speed, color: ColorsAppQy.qyPrimary),
                title: Text(
                  QyAppLocalizationKeys.qyListeningSpeed.tr(context),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                  ),
                ),
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
                title: Text(
                  QyAppLocalizationKeys.qyListeningLoop.tr(context),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                  ),
                ),
                secondary: Icon(
                  Icons.loop,
                  color: _isLooping
                      ? ColorsAppQy.qyAccent
                      : ColorsAppQy.qyTextTertiary,
                ),
              ),
              SwitchListTile(
                value: _isShuffling,
                onChanged: (value) {
                  _toggleShuffle();
                  Navigator.of(context).pop();
                },
                title: Text(
                  QyAppLocalizationKeys.qyListeningShuffle.tr(context),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                  ),
                ),
                secondary: Icon(
                  Icons.shuffle,
                  color: _isShuffling
                      ? ColorsAppQy.qyPrimary
                      : ColorsAppQy.qyTextTertiary,
                ),
              ),
            ],
          ),
        ),
        borderRadius: ThemeDimensions.borderRadiusL,
      ),
    );
  }
}
