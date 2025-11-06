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

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/word_controller_app_qy.dart';

class WordListeningFreeScreenRefactoredAppQy extends StatefulWidget {
  const WordListeningFreeScreenRefactoredAppQy({super.key});

  @override
  State<WordListeningFreeScreenRefactoredAppQy> createState() =>
      _WordListeningFreeScreenRefactoredAppQyState();
}

class _WordListeningFreeScreenRefactoredAppQyState
    extends State<WordListeningFreeScreenRefactoredAppQy> {
  bool _isVipMember;

  _WordListeningFreeScreenRefactoredAppQyState() : _isVipMember = false;

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
      body: Column(
        children: [
          _buildWordBookSelector(),
          Expanded(
            child: _buildContent(),
          ),
        ],
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

  Widget _buildContent() {
    return SingleChildScrollView(
      child: Column(
        children: [
          _buildFreeMode(),
          if (!_isVipMember) _buildVipPrompt(),
        ],
      ),
    );
  }

  Widget _buildFreeMode() {
    return Container(
      margin: EdgeInsets.all(Dimensions.paddingMedium),
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(Dimensions.paddingSmall),
                decoration: BoxDecoration(
                  color: ThemeColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                ),
                child: Icon(
                  Icons.settings_suggest,
                  color: ThemeColors.primary,
                  size: 32,
                ),
              ),
              SizedBox(width: Dimensions.spacingMedium),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      QyAppLocalizationKeys.qyWordFreeMode.tr(context),
                      style: TextStyles.h4.copyWith(
                        color: ThemeColors.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: Dimensions.spacingXSmall),
                    Text(
                      QyAppLocalizationKeys.qyWordFreeModeDesc.tr(context),
                      style: TextStyles.caption.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildVipPrompt() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: Dimensions.paddingMedium),
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.amber.withOpacity(0.2),
            Colors.orange.withOpacity(0.2),
          ],
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        border: Border.all(color: Colors.amber.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Icon(
            Icons.workspace_premium,
            size: 64,
            color: Colors.amber,
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyWordListeningExpired.tr(context),
            style: TextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyJoinMembershipDesc.tr(context),
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: Dimensions.spacingLarge),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.amber,
              padding: EdgeInsets.symmetric(
                horizontal: Dimensions.paddingXLarge,
                vertical: Dimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              ),
            ),
            child: Text(
              QyAppLocalizationKeys.qyJoinMembership.tr(context),
              style: TextStyles.button.copyWith(
                color: ThemeColors.surface,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
