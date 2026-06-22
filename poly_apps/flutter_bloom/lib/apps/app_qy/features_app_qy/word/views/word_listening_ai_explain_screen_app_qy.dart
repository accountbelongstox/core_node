// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordListeningAiExplainScreenRefactoredAppQy extends StatefulWidget {
  const WordListeningAiExplainScreenRefactoredAppQy({super.key});

  @override
  State<WordListeningAiExplainScreenRefactoredAppQy> createState() =>
      _WordListeningAiExplainScreenRefactoredAppQyState();
}

class _WordListeningAiExplainScreenRefactoredAppQyState
    extends State<WordListeningAiExplainScreenRefactoredAppQy> {
  final TextEditingController _questionController = TextEditingController();
  final List<Map<String, dynamic>> _conversation = [];
  bool _isAiTyping = false;

  final Map<String, dynamic> _currentWord = {
    'word': 'extraordinary',
    'phonetic': '/ɪkˈstrɔːdnri/',
    'definition': 'Very unusual or remarkable',
    'examples': [
      'She has an extraordinary talent for music.',
      'The view from the top was extraordinary.',
    ],
    'synonyms': ['remarkable', 'exceptional', 'outstanding', 'unusual'],
    'etymology': 'From Latin extra "outside" + ordinarius "ordinary"',
    'usage_tips': [
      'Often used to emphasize how special or unusual something is',
      'More formal than "amazing" or "incredible"',
      'Can be used before nouns or after linking verbs',
    ],
  };

  final List<String> _quickQuestions = [];

  @override
  void initState() {
    super.initState();
    _initQuickQuestions();
    _addInitialMessage();
  }

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  void _initQuickQuestions() {
    _quickQuestions.addAll([
      'How do I use this word in a sentence?',
      'What are similar words?',
      'Can you explain the pronunciation?',
      'Give me more examples',
      'What is the word origin?',
      'When should I use this word?',
    ]);
  }

  void _addInitialMessage() {
    _conversation.add({
      'isUser': false,
      'message':
          'Hello! I\'m your AI language assistant. I can help you understand "${_currentWord['word']}" better. Ask me anything about this word!',
      'timestamp': DateTime.now(),
    });
  }

  void _sendMessage(String message) {
    if (message.trim().isEmpty) return;

    setState(() {
      _conversation.add({
        'isUser': true,
        'message': message,
        'timestamp': DateTime.now(),
      });
      _isAiTyping = true;
    });

    _questionController.clear();

    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _conversation.add({
            'isUser': false,
            'message': _generateAiResponse(message),
            'timestamp': DateTime.now(),
          });
          _isAiTyping = false;
        });
      }
    });
  }

  String _generateAiResponse(String question) {
    final lowerQuestion = question.toLowerCase();

    if (lowerQuestion.contains('sentence') || lowerQuestion.contains('use')) {
      return 'Here are some ways to use "${_currentWord['word']}" in sentences:\n\n'
          '${_currentWord['examples'].map((e) => '• $e').join('\n')}\n\n'
          'Notice how it emphasizes the exceptional nature of the subject!';
    } else if (lowerQuestion.contains('similar') ||
        lowerQuestion.contains('synonym')) {
      return 'Words similar to "${_currentWord['word']}" include:\n\n'
          '${(_currentWord['synonyms'] as List).map((s) => '• $s').join('\n')}\n\n'
          'Each has slightly different connotations, but they all indicate something special or unusual.';
    } else if (lowerQuestion.contains('pronunciation') ||
        lowerQuestion.contains('pronounce')) {
      return 'The pronunciation is: ${_currentWord['phonetic']}\n\n'
          'Break it down:\n'
          '• "ex-TRAOR-di-nar-y"\n'
          '• Stress on the second syllable\n'
          '• The "a" sounds like "aw" in "law"\n\n'
          'Try saying it slowly first, then speed up!';
    } else if (lowerQuestion.contains('origin') ||
        lowerQuestion.contains('etymology')) {
      return 'Etymology of "${_currentWord['word']}":\n\n'
          '${_currentWord['etymology']}\n\n'
          'The prefix "extra-" means "outside" or "beyond", so extraordinary literally means "beyond ordinary"!';
    } else if (lowerQuestion.contains('example')) {
      return 'Here are additional examples:\n\n'
          '• The chef prepared an extraordinary meal.\n'
          '• It takes extraordinary effort to master a language.\n'
          '• She showed extraordinary courage in difficult times.\n\n'
          'Would you like more examples in specific contexts?';
    } else if (lowerQuestion.contains('when') ||
        lowerQuestion.contains('should')) {
      return 'Usage tips for "${_currentWord['word']}":\n\n'
          '${(_currentWord['usage_tips'] as List).map((t) => '• $t').join('\n')}\n\n'
          'Use it when you want to emphasize that something is truly exceptional!';
    } else {
      return 'That\'s a great question about "${_currentWord['word']}"!\n\n'
          'Definition: ${_currentWord['definition']}\n\n'
          'Feel free to ask more specific questions like:\n'
          '• How to use it in sentences\n'
          '• Similar words\n'
          '• Pronunciation help\n'
          '• Word origin';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyAiExplain.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        actions: [
          IconButton(
            onPressed: () {
              setState(() {
                _conversation.clear();
                _addInitialMessage();
              });
            },
            icon: Icon(Icons.refresh, color: ThemeColors.textPrimary),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildWordHeader(),
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              itemCount: _conversation.length + (_isAiTyping ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _conversation.length && _isAiTyping) {
                  return _buildTypingIndicator();
                }
                return _buildMessageBubble(_conversation[index]);
              },
            ),
          ),
          _buildQuickQuestions(),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildWordHeader() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary,
            ThemeColors.primary.withOpacity(0.8),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
            decoration: BoxDecoration(
              color: ThemeColors.surface.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.psychology,
              color: ThemeColors.surface,
              size: ThemeDimensions.iconSizeXL,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _currentWord['word'] as String,
                  style: ThemeTextStyles.h3.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  _currentWord['phonetic'] as String,
                  style: ThemeTextStyles.body2.copyWith(
                    color: ThemeColors.surface.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.volume_up, color: ThemeColors.surface),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(Map<String, dynamic> message) {
    final isUser = message['isUser'] as bool;

    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      child: Row(
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              width: ThemeDimensions.iconSizeXL + ThemeDimensions.spacing4,
              height: ThemeDimensions.iconSizeXL + ThemeDimensions.spacing4,
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.smart_toy,
                color: ThemeColors.primary,
                size: ThemeDimensions.iconSizeM,
              ),
            ),
            SizedBox(width: ThemeDimensions.spacingSmall),
          ],
          Flexible(
            child: Container(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              decoration: BoxDecoration(
                color: isUser ? ThemeColors.primary : ThemeColors.surface,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(ThemeDimensions.radiusMedium),
                  topRight: Radius.circular(ThemeDimensions.radiusMedium),
                  bottomLeft: isUser
                      ? Radius.circular(ThemeDimensions.radiusMedium)
                      : Radius.zero,
                  bottomRight: isUser
                      ? Radius.zero
                      : Radius.circular(ThemeDimensions.radiusMedium),
                ),
                border: isUser ? null : Border.all(color: ThemeColors.border),
              ),
              child: Text(
                message['message'] as String,
                style: ThemeTextStyles.body2.copyWith(
                  color: isUser ? ThemeColors.surface : ThemeColors.textPrimary,
                ),
              ),
            ),
          ),
          if (isUser) ...[
            SizedBox(width: ThemeDimensions.spacingSmall),
            Container(
              width: ThemeDimensions.iconSizeXL + ThemeDimensions.spacing4,
              height: ThemeDimensions.iconSizeXL + ThemeDimensions.spacing4,
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.person,
                color: ThemeColors.primary,
                size: ThemeDimensions.iconSizeM,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.smart_toy,
              color: ThemeColors.primary,
              size: 20,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingSmall),
          Container(
            padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
            decoration: BoxDecoration(
              color: ThemeColors.surface,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
              border: Border.all(color: ThemeColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildDot(0),
                SizedBox(width: ThemeDimensions.spacing4),
                _buildDot(1),
                SizedBox(width: ThemeDimensions.spacing4),
                _buildDot(2),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDot(int index) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 600),
      curve: Curves.easeInOut,
      builder: (context, value, child) {
        return Container(
          width: ThemeDimensions.spacing8,
          height: ThemeDimensions.spacing8,
          decoration: BoxDecoration(
            color: ThemeColors.primary.withOpacity(
              0.3 + (0.7 * ((value + index * 0.33) % 1.0)),
            ),
            shape: BoxShape.circle,
          ),
        );
      },
      onEnd: () {
        if (mounted) setState(() {});
      },
    );
  }

  Widget _buildQuickQuestions() {
    return Container(
      height: ThemeDimensions.spacing48 + ThemeDimensions.spacing2,
      padding: EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSmall),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding:
            EdgeInsets.symmetric(horizontal: ThemeDimensions.paddingMedium),
        itemCount: _quickQuestions.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: EdgeInsets.only(right: ThemeDimensions.spacingSmall),
            child: InkWell(
              onTap: () => _sendMessage(_quickQuestions[index]),
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingMedium,
                  vertical: ThemeDimensions.paddingSmall,
                ),
                decoration: BoxDecoration(
                  color: ThemeColors.surface,
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.radiusLarge),
                  border:
                      Border.all(color: ThemeColors.primary.withOpacity(0.3)),
                ),
                child: Center(
                  child: Text(
                    _quickQuestions[index],
                    style: ThemeTextStyles.caption.copyWith(
                      color: ThemeColors.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          top: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _questionController,
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: QyAppLocalizationKeys.qyAskQuestion.tr(context),
                  hintStyle: ThemeTextStyles.body2.copyWith(
                    color: ThemeColors.textTertiary,
                  ),
                  filled: true,
                  fillColor: ThemeColors.background,
                  border: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusLarge),
                    borderSide: BorderSide(color: ThemeColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusLarge),
                    borderSide: BorderSide(color: ThemeColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusLarge),
                    borderSide: BorderSide(
                        color: ThemeColors.primary,
                        width: ThemeDimensions.spacing2),
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingMedium,
                    vertical: ThemeDimensions.paddingSmall,
                  ),
                ),
                maxLines: null,
                textInputAction: TextInputAction.send,
                onSubmitted: (value) => _sendMessage(value),
              ),
            ),
            SizedBox(width: ThemeDimensions.spacingSmall),
            Container(
              decoration: BoxDecoration(
                color: ThemeColors.primary,
                shape: BoxShape.circle,
              ),
              child: IconButton(
                onPressed: () => _sendMessage(_questionController.text),
                icon: Icon(Icons.send, color: ThemeColors.surface),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
