import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:qyflutter/apps/app_example/features_app_example/word_card/controller/word_card_controller.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
// Updated: Using new base theme system (符合最新文档规范)
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class WordCardScreen extends StatelessWidget {
  const WordCardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(WordCardController());

    return Scaffold(
      appBar: CustomAppBar(
        title: '单词学习',
        showBackButton: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _buildMainContent(),
            ),
            _buildBottomActions(),
          ],
        ),
      ),
    );
  }

  Widget _buildMainContent() {
    return Container(
      padding: ThemeDimensions.paddingM,
      child: Card(
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(15),
        ),
        child: Container(
          padding: const EdgeInsets.all(20),
          child: GetBuilder<WordCardController>(
            builder: (controller) => Builder(
              builder: (context) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    controller.currentWord.word,
                    // Updated: Using base theme system
                    style: ThemeTextStyles.title1Bold,
                  ),
                  SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    controller.currentWord.phonetic,
                    // Updated: Using base theme system
                    style: ThemeTextStyles.callout,
                  ),
                  SizedBox(height: ThemeDimensions.spacing16),
                  Text(
                    controller.currentWord.translation,
                    // Updated: Using base theme system
                    style: ThemeTextStyles.body,
                  ),
                  SizedBox(height: ThemeDimensions.spacing24),
                  Text(
                    '例句:',
                    // Updated: Using base theme system
                    style: ThemeTextStyles.title3Bold,
                  ),
                  SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    controller.currentWord.example,
                    // Updated: Using base theme system
                    style: ThemeTextStyles.body,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomActions() {
    return Container(
      padding: ThemeDimensions.paddingM,
      child: Builder(
        builder: (context) => Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildActionButton(
              context: context,
              icon: Icons.volume_up,
              label: '发音',
              onPressed: () => Get.find<WordCardController>().playPronunciation(),
            ),
            _buildActionButton(
              context: context,
              icon: Icons.check_circle,
              label: '认识',
              onPressed: () => Get.find<WordCardController>().markAsKnown(),
              color: Colors.green,
            ),
            _buildActionButton(
              context: context,
              icon: Icons.close,
              label: '不认识',
              onPressed: () => Get.find<WordCardController>().markAsUnknown(),
              color: Colors.red,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required BuildContext context,
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    Color? color,
  }) {
    return ElevatedButton.icon(
      icon: Icon(icon),
      label: Text(
        label,
        // Updated: Using base theme system
        style: ThemeTextStyles.calloutBold,
      ),
      onPressed: onPressed,
      // Updated: Using base theme system with simple styling
      style: ElevatedButton.styleFrom(
        backgroundColor: color ?? Theme.of(context).colorScheme.primary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusM),
        ),
      ),
    );
  }
}
