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
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../config_app_bank/bank_text_styles.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../localization_app_bank/localization_keys_app_bank.dart';

/// Bank Onboarding Screen
/// Introduces users to the main features of the banking app
class BankOnboardingScreen extends StatefulWidget {
  const BankOnboardingScreen({super.key});

  @override
  State<BankOnboardingScreen> createState() => _BankOnboardingScreenState();
}

class _BankOnboardingScreenState extends State<BankOnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  List<OnboardingPage> get _pages => [
    OnboardingPage(
      icon: Icons.account_balance_wallet,
      title: BankLocalizationKeys.bankSecureBanking.tr(context),
      description: 'Manage your accounts with bank-grade security and encryption for complete peace of mind.',
      backgroundColor: const Color(0xFF1E88E5),
    ),
    OnboardingPage(
      icon: Icons.send_to_mobile,
      title: BankLocalizationKeys.bankQuickTransfers.tr(context),
      description: 'Send money instantly to friends and family with just a few taps. Fast, secure, and reliable.',
      backgroundColor: const Color(0xFF43A047),
    ),
    OnboardingPage(
      icon: Icons.trending_up,
      title: BankLocalizationKeys.bankSmartInvestments.tr(context),
      description: 'Grow your wealth with our intelligent investment tools and expert financial guidance.',
      backgroundColor: const Color(0xFF8E24AA),
    ),
    OnboardingPage(
      icon: Icons.credit_card,
      title: BankLocalizationKeys.bankDigitalCards.tr(context),
      description: 'Manage all your cards in one place. Block, unblock, and monitor transactions in real-time.',
      backgroundColor: const Color(0xFFFF7043),
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onPageChanged(int page) {
    setState(() {
      _currentPage = page;
    });
  }

  void _nextPage() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _navigateToAuth();
    }
  }

  void _skipOnboarding() {
    _navigateToAuth();
  }

  void _navigateToAuth() {
    // Skip authentication, go directly to dashboard
    context.go(BankConstants.routeDashboard);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // Skip Button
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(ThemeDimensions.paddingMedium),
                child: TextButton(
                  onPressed: _skipOnboarding,
                  child: Text(
                    'Skip',
                    style: BankTextStyles.buttonTextSecondary,
                  ),
                ),
              ),
            ),
          ),

          // Page View
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: _onPageChanged,
              itemCount: _pages.length,
              itemBuilder: (context, index) {
                return _pages[index];
              },
            ),
          ),

          // Page Indicators and Navigation
          Padding(
            padding: const EdgeInsets.all(ThemeDimensions.paddingLarge),
            child: Column(
              children: [
                // Page Indicators
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    _pages.length,
                    (index) => AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      height: 8,
                      width: _currentPage == index ? 24 : 8,
                      decoration: BoxDecoration(
                        color: _currentPage == index
                            ? ThemeColors.primaryColor
                            : ThemeColors.surfaceVariant,
                        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: ThemeDimensions.spacingLarge),

                // Next/Get Started Button
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _nextPage,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ThemeColors.primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                      ),
                    ),
                    child: Text(
                      _currentPage == _pages.length - 1 ? 'Get Started' : 'Next',
                      style: ThemeTextStyles.buttonText,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Individual Onboarding Page Widget
class OnboardingPage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color backgroundColor;

  const OnboardingPage({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(ThemeDimensions.paddingLarge),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Illustration/Icon
          Container(
            width: 160,
            height: 160,
            decoration: BoxDecoration(
              color: backgroundColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 80,
              color: backgroundColor,
            ),
          ),

          const SizedBox(height: ThemeDimensions.spacingXLarge),

          // Title
          Text(
            title,
            style: BankTextStyles.headingLarge.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: ThemeDimensions.spacingMedium),

          // Description
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.paddingMedium),
            child: Text(
              description,
              style: BankTextStyles.bodyLarge.copyWith(
                color: ThemeColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}