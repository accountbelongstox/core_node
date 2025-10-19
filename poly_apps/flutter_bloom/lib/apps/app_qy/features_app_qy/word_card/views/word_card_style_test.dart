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

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

import 'package:qyflutter/common/widgets/custom_app_bar.dart';

/// Style test screen for Word Card functionality
/// This screen demonstrates all the styles used in the word card feature
/// and validates that the style system works correctly
class WordCardStyleTestScreen extends StatelessWidget {
  const WordCardStyleTestScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(
        title: 'Word Card Style Test',
        showBackButton: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: ThemeDimensions.paddingM,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Style System Info
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Style System Information',
                        style: ThemeTextStyles.title1Bold,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Screen Size: ${ThemeDimensions.getScreenSizeCategory(context)}',
                        style: ThemeTextStyles.body,
                      ),
                      Text(
                        'Theme: ${ThemeDimensions.isDarkTheme(context) ? 'Dark' : 'Light'}',
                        style: ThemeTextStyles.body,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Word Card Styles Demo
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Word Card Styles Demo',
                        style: ThemeTextStyles.title3,
                      ),
                      const SizedBox(height: 16),

                      // Word Title Style
                      Text(
                        'apple',
                        style: ThemeTextStyles.wordTitle,
                      ),
                      const SizedBox(height: 8),

                      // Phonetic Text Style
                      Text(
                        '/ˈæpl/',
                        style: ThemeTextStyles.phoneticText,
                      ),
                      const SizedBox(height: 16),

                      // Translation Text Style
                      Text(
                        'n. 苹果',
                        style: ThemeTextStyles.translationText,
                      ),
                      const SizedBox(height: 24),

                      // Example Title Style
                      Text(
                        '例句:',
                        style: ThemeTextStyles.titleMedium,
                      ),
                      const SizedBox(height: 8),

                      // Example Text Style
                      Text(
                        'An apple a day keeps the doctor away.',
                        style: ThemeTextStyles.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Button Styles Demo
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Button Styles Demo',
                        style: ThemeTextStyles.title3,
                      ),
                      const SizedBox(height: 16),

                      // Primary Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.volume_up),
                          label: const Text('Primary Button'),
                          onPressed: () {},
                          style: ThemeDimensions.primaryButtonStyle.copyWith(
                            shape: MaterialStateProperty.all(
                              RoundedRectangleBorder(
                                borderRadius: ThemeDimensions.getAdaptiveBorderRadius(context),
                              ),
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 12),

                      // Secondary Button
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.check_circle),
                          label: const Text('Secondary Button'),
                          onPressed: () {},
                          style: ThemeDimensions.secondaryButtonStyle.copyWith(
                            shape: MaterialStateProperty.all(
                              RoundedRectangleBorder(
                                borderRadius: ThemeDimensions.getAdaptiveBorderRadius(context),
                              ),
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 12),

                      // Danger Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.close),
                          label: const Text('Danger Button'),
                          onPressed: () {},
                          style: ThemeDimensions.dangerButtonStyle.copyWith(
                            shape: MaterialStateProperty.all(
                              RoundedRectangleBorder(
                                borderRadius: ThemeDimensions.getAdaptiveBorderRadius(context),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // App-Specific Styles Demo
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'App-Specific Styles Demo',
                        style: ThemeTextStyles.getThemedStyle(ThemeTextStyles.appSubtitle, context),
                      ),
                      const SizedBox(height: 16),

                      // Donation Style
                      Text(
                        'Donation Title',
                        style: ThemeTextStyles.getThemedStyle(ThemeTextStyles.donationTitle, context),
                      ),
                      Text(
                        '\$1,234.56',
                        style: ThemeTextStyles.getThemedStyle(ThemeTextStyles.donationAmount, context),
                      ),
                      Text(
                        'Help children in need around the world.',
                        style: ThemeTextStyles.getThemedStyle(ThemeTextStyles.donationDescription, context),
                      ),

                      const SizedBox(height: 16),

                      // Prayer Style
                      Text(
                        'Prayer Title',
                        style: ThemeTextStyles.getThemedStyle(ThemeTextStyles.prayerTitle, context),
                      ),
                      Text(
                        'May peace and love be with everyone in the world.',
                        style: ThemeTextStyles.getThemedStyle(ThemeTextStyles.prayerContent, context),
                      ),

                      const SizedBox(height: 16),

                      // Profile Style
                      Text(
                        'John Doe',
                        style: ThemeTextStyles.getThemedStyle(ThemeTextStyles.profileName, context),
                      ),
                      Text(
                        'Software Developer from New York',
                        style: ThemeTextStyles.getThemedStyle(ThemeTextStyles.profileDetail, context),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Responsive Padding Demo
              Container(
                width: double.infinity,
                padding: ThemeDimensions.getResponsivePadding(context),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: ThemeDimensions.getAdaptiveBorderRadius(context),
                ),
                child: Text(
                  'This container uses responsive padding and adaptive border radius',
                  style: ThemeTextStyles.body,
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
