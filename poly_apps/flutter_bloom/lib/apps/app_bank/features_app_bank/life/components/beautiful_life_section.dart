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
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';

class BeautifulLifeSection extends StatelessWidget {
  const BeautifulLifeSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BankSectionCard(
      title: '美好生活',
      moreText: '更多',
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFBFCFE),
          Color(0xFFFBFCFE),
        ],
      ),
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final availableWidth = constraints.maxWidth;
            final rightColumnWidth = (availableWidth - 12) / 2;
            final itemHeight = (rightColumnWidth * 0.6).clamp(60.0, 100.0);
            final totalHeight = itemHeight * 2 + 12;
            
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 左边区域：背景图
                Expanded(
                  flex: 1,
                  child: Container(
                    height: totalHeight,
                    decoration: BoxDecoration(
                      image: DecorationImage(
                        image: AssetImage(BankImages.beautifulLifeBg),
                        fit: BoxFit.cover,
                        alignment: Alignment.topCenter,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // 右边区域：两个食品项目（图在左，文字在右）
                Expanded(
                  flex: 1,
                  child: SizedBox(
                    height: totalHeight,
                    child: Column(
                      children: [
                        Expanded(
                          flex: 1,
                          child: _buildFoodItem(
                            imagePath: BankImages.burgerKingIcon,
                            title: '汉堡王',
                            discount: '低至5折起',
                          ),
                        ),
                        const SizedBox(height: 12),
                        Expanded(
                          flex: 1,
                          child: _buildFoodItem(
                            imagePath: BankImages.pizzaHutIcon,
                            title: '必胜客',
                            discount: '低至6.1折',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildFoodItem({
    required String imagePath,
    required String title,
    required String discount,
  }) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                imagePath,
                width: 50,
                height: 50,
                fit: BoxFit.cover,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // 第一行：商家名称
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                    fontFamily: 'PingFang SC',
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
                const SizedBox(height: 4),
                // 第二行：券低至X折
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: const Color(0xFFFF6B35),
                      width: 1,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 1),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFF6B35),
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(3),
                            bottomLeft: Radius.circular(3),
                          ),
                        ),
                        child: const Text(
                          '券',
                          style: TextStyle(
                            fontSize: 8,
                            color: Colors.white,
                            fontFamily: 'PingFang SC',
                          ),
                        ),
                      ),
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 4, vertical: 1),
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.only(
                              topRight: Radius.circular(3),
                              bottomRight: Radius.circular(3),
                            ),
                          ),
                          child: Text(
                            discount,
                            style: const TextStyle(
                              fontSize: 8,
                              color: Color(0xFFFF6B35),
                              fontFamily: 'PingFang SC',
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        ),
                      ),
                    ],
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
