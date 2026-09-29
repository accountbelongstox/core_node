/// Word Listening Dictation 3 Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordListeningDictation3ScreenAppQy extends StatefulWidget {
  const WordListeningDictation3ScreenAppQy({super.key});

  @override
  State<WordListeningDictation3ScreenAppQy> createState() =>
      _WordListeningDictation3ScreenAppQyState();
}

class _WordListeningDictation3ScreenAppQyState
    extends State<WordListeningDictation3ScreenAppQy> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyWordListeningDictation.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildContent(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.construction,
            size: ThemeDimensions.spacing64,
            color: ThemeColors.primary.withOpacity(0.5),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            '${QyAppLocalizationKeys.qyWordListeningDictation.tr(context)} - ${QyAppLocalizationKeys.qyComingSoon.tr(context)}',
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyUnderDevelopment.tr(context),
            style: ThemeTextStyles.caption.copyWith(
              color: ThemeColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }
}
