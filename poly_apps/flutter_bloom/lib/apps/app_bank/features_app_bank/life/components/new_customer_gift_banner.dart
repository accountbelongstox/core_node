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
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../widgets_app_bank/bank_section_card.dart';

class NewCustomerGiftBanner extends StatelessWidget {
  const NewCustomerGiftBanner({super.key});

  static const TextStyle _mainTextStyle = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w700,
    color: Colors.black87,
  );

  static const TextStyle _subtitleStyle = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: Color(0xFFFF6B35),
  );

  static const TextStyle _cardTitleStyle = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: Colors.black87,
  );

  static const TextStyle _cardDescriptionStyle = TextStyle(
    fontSize: 9,
    color: Colors.grey,
  );

  static BoxDecoration get _cardDecoration => BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF8FCFF),
            Color(0xFFF9F8F4),
          ],
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Colors.white,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            spreadRadius: 0,
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      );

  @override
  Widget build(BuildContext context) {
    return BankSectionCard(
      title: '手机银行新客礼',
      titleFontSize: 18,
      titleFontWeight: FontWeight.w700,
      titleColor: Colors.black87,
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFF8FCFF),
          Color(0xFFF8FCFF),
        ],
      ),
      children: [
        _buildMainCard(),
        const SizedBox(height: 12),
        _buildSmallCardsRow(),
      ],
    );
  }

  Widget _buildMainCard() {
    return Container(
      width: double.infinity,
      height: 84,
      decoration: _cardDecoration,
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                BankImages.newCustomerGiftMiddleBg,
                fit: BoxFit.cover,
                alignment: Alignment.centerRight,
              ),
            ),
          ),
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    Colors.white.withOpacity(0.85),
                    Colors.white.withOpacity(0.6),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '至高100元立减金',
                  style: _mainTextStyle,
                ),
                const SizedBox(height: 2),
                Text(
                  '首次开通手机银行可领',
                  style: _subtitleStyle,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSmallCardsRow() {
    return Row(
      children: [
        Expanded(
          child: _buildSmallCard(
            title: '好券中心',
            description: '精选好券限时领',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildSmallCard(
            title: '低碳生活',
            description: '抢兑20元立减金',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildSmallCard(
            title: '做任务赢好礼',
            description: '抽100元立减金',
          ),
        ),
      ],
    );
  }

  Widget _buildSmallCard({
    required String title,
    required String description,
  }) {
    return Container(
      height: 60,
      decoration: _cardDecoration,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                title,
                style: _cardTitleStyle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 1),
            Flexible(
              child: Text(
                description,
                style: _cardDescriptionStyle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
