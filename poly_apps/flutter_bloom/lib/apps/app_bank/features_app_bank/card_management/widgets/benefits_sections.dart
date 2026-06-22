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
import '../../../config_app_bank/constants.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../widgets_app_bank/bank_gradient_card.dart';
import '../../../widgets_app_bank/bank_image_widget.dart';
import '../../../widgets_app_bank/bank_action_button.dart';
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';

class BenefitsSections {
  static Widget buildCombinedBenefits(BuildContext context) {
    return BankSectionCard(
      title: '增值礼遇',
      moreText: '更多',
      onMoreTap: () {
        BankLoadingDialog.show(context, title: '更多');
      },
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 16),
      titleBottomPadding: BankConstants.sectionTitleBottomPadding,
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFF3F2F0),
          Color(0xFFF1F8FE),
        ],
      ),
      children: [
        ClipRRect(
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
          ),
          child: IntrinsicHeight(
            child: Stack(
              children: [
                BankImageWidget(
                  imagePath: BankImages.conciergeCarBannerBg,
                  fit: BoxFit.fitWidth,
                  width: double.infinity,
                ),
                Positioned(
                  left: 12,
                  top: 8,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '携宠礼宾车优惠购',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.black,
                        ),
                        textAlign: TextAlign.left,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '境内机场高铁接送机',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.black,
                        ),
                        textAlign: TextAlign.left,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        BankGradientCard(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFE8F4F8), Color(0xFFD1ECF1)],
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '建信福贷',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    '20万',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '灵活借还 快速到账',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.black87,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '额度最高',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                '由建信消费金融公司提供',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.black54,
                ),
              ),
              const SizedBox(height: 16),
              BankActionButton(
                text: '立即查看',
                onTap: () {
                  BankLoadingDialog.show(context, title: '建信福贷');
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  static Widget buildValueAddedBenefits(BuildContext context) {
    return BankSectionCard(
      title: '增值礼遇',
      moreText: '更多',
      onMoreTap: () {
        BankLoadingDialog.show(context, title: '更多');
      },
      padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 0),
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFF3F2F0),
          Color(0xFFF1F8FE),
        ],
      ),
      children: [
        Container(
          margin: const EdgeInsets.only(top: 4),
          height: 120,
          child: ClipRRect(
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(16),
              bottomRight: Radius.circular(16),
            ),
            child: Stack(
              children: [
                BankImageWidget(
                  imagePath: BankImages.conciergeCarBannerBg,
                  fit: BoxFit.cover,
                ),
                Positioned(
                  left: 12,
                  top: 8,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '携宠礼宾车优惠购',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.black,
                        ),
                        textAlign: TextAlign.left,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '境内机场高铁接送机',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.black,
                        ),
                        textAlign: TextAlign.left,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static Widget buildFeaturedRecommendations(BuildContext context) {
    return BankSectionCard(
      title: '特色推荐',
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFF3F2F0),
          Color(0xFFF1F8FE),
        ],
      ),
      children: [
        BankGradientCard(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFE8F4F8), Color(0xFFD1ECF1)],
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '建信福贷',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    '20万',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '灵活借还 快速到账',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.black87,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '额度最高',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                '由建信消费金融公司提供',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.black54,
                ),
              ),
              const SizedBox(height: 16),
              BankActionButton(
                text: '立即查看',
                onTap: () {
                  BankLoadingDialog.show(context, title: '建信福贷');
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
