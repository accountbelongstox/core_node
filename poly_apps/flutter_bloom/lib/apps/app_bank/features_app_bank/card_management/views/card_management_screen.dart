// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\" instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/widgets/bank_scaffold.dart';
import '../../../config_app_bank/theme_config_app_bank.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import '../components/card_top_header.dart';
import '../components/card_features_grid.dart';
import '../../../widgets_app_bank/bank_banner_card.dart';
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import '../widgets/offer_cards.dart';
import '../widgets/installment_sections.dart';
import '../widgets/benefits_sections.dart';
import '../components/login_prompt_card.dart';

class BankCardManagementScreen extends StatelessWidget {
  const BankCardManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BankScaffold(
      currentBottomNavIndex: 1,
      backgroundColor: BankColorProvider.scaffoldBackground,
      body: Consumer<BankUserProvider>(
        builder: (context, provider, child) {
          final user = provider.user;
          final isLoggedIn = user != null || provider.globalData?.fullName != null;
          
          return SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CardTopHeader(),
                const CardFeaturesGrid(),
                if (!isLoggedIn) const LoginPromptCard(),
                _buildCardRecommendation(context),
                _buildNewbieBanner(context),
                InstallmentSections.buildInstallmentBenefits(context),
                InstallmentSections.buildInstallmentShopping(context),
                BenefitsSections.buildCombinedBenefits(context),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCardRecommendation(BuildContext context) {
    return BankSectionCard(
      titleImagePath: BankImages.bankLatestOffersTitle,
      titleImageHeight: 32,
      titleImageFit: BoxFit.contain,
      moreText: '更多',
      onMoreTap: () {
        BankLoadingDialog.show(context, title: '更多');
      },
      backgroundImagePath: BankImages.bankLatestOffersBg,
      backgroundImageFit: BoxFit.cover,
      children: [
        OfferCards.buildMainOfferCard(),
      ],
    );
  }

  Widget _buildNewbieBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: BankBannerCard(
        title: '新户线上办卡达标',
        subtitle: '享128好礼',
        backgroundImagePath: BankImages.newbieCardBg,
        textColor: Colors.white,
      ),
    );
  }
}
