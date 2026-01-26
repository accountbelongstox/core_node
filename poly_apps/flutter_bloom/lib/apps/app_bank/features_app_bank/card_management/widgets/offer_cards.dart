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
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../widgets_app_bank/bank_simple_card.dart';
import '../../../widgets_app_bank/bank_pagination_dots.dart';
import '../../../widgets_app_bank/bank_small_button.dart';
import '../../../widgets_app_bank/bank_text_with_subtitle.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';

class OfferCards {
  static Widget buildMainOfferCard() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Flexible(
          flex: 1,
          child: buildWorldCard(),
        ),
        const SizedBox(width: 8),
        Flexible(
          flex: 1,
          child: SizedBox(
            height: 144,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: 70,
                  child: buildSnowCard(),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: buildCarCard(),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static Widget buildWorldCard() {
    return Builder(
      builder: (context) => BankSimpleCard(
        padding: EdgeInsets.zero,
        onTap: () {
          BankLoadingDialog.show(context, title: '玩转世界');
        },
        child: Container(
          height: 144,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFFF0F0F0),
                Color(0xFFF1F1F1),
                Color(0xFFF2F2F2),
                Color(0xFFF3F3F3),
              ],
            ),
            border: Border.all(
              color: Colors.white,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                spreadRadius: 0,
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Stack(
          children: [
            Positioned(
              left: 16,
              top: 16,
              right: 16,
              bottom: 80,
              child: Image.asset(
                BankImages.offerWorldIcon,
                width: double.infinity,
                fit: BoxFit.fitWidth,
              ),
            ),
            Positioned(
              left: 16,
              bottom: 16,
              right: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    '玩转世界',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    '境外线下消费8%返现',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.black54,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const BankPaginationDots(currentIndex: 1),
                ],
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }

  static Widget buildSnowCard() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final containerWidth = constraints.maxWidth;
        final imageWidth = containerWidth * 0.42;
        final imageAspectRatio = 200.0 / 153.0;
        final imageHeight = imageWidth / imageAspectRatio;

        return Container(
          margin: const EdgeInsets.all(0),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFFF3F3F3),
                Color(0xFFF4F4F4),
                Color(0xFFF5F5F5),
                Color(0xFFF6F6F6),
                Color(0xFFF7F7F7),
              ],
            ),
            border: Border.all(
              color: Colors.white,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                spreadRadius: 0,
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                BankLoadingDialog.show(context, title: '"享趣"玩');
              },
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
              child: Stack(
                children: [
                  Positioned(
                    right: 8,
                    bottom: 12,
                    child: Image.asset(
                      BankImages.offerSnowIcon,
                      width: imageWidth,
                      height: imageHeight,
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.high,
                    ),
                  ),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              '"享趣"玩',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Colors.black87,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 1),
                            const Text(
                              '冰雪季',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Colors.black87,
                                height: 1.2,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        BankSmallButton(
                          text: '去看看',
                          onTap: () {
                            BankLoadingDialog.show(context, title: '"享趣"玩');
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  static Widget buildCarCard() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final containerWidth = constraints.maxWidth;
        final imageWidth = containerWidth * 0.35;
        final imageAspectRatio = 200.0 / 109.0;
        final imageHeight = imageWidth / imageAspectRatio;

        return Container(
          margin: const EdgeInsets.all(0),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFFF8FAFA),
                Color(0xFFF7F9F9),
                Color(0xFFF6F8F8),
                Color(0xFFF5F7F7),
                Color(0xFFF4F7F5),
              ],
            ),
            border: Border.all(
              color: Colors.white,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                spreadRadius: 0,
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned(
                right: 8,
                bottom: 12,
                child: Image.asset(
                  BankImages.offerCarCardIcon,
                  width: imageWidth,
                  height: imageHeight,
                  fit: BoxFit.contain,
                  filterQuality: FilterQuality.high,
                ),
              ),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    BankLoadingDialog.show(context, title: '运通白金汽车卡');
                  },
                  borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                  child: Padding(
                    padding: const EdgeInsets.only(
                        left: 12, top: 10, right: 12, bottom: 10),
                    child: BankTextWithSubtitle(
                      title: '运通白金汽车卡',
                      subtitle: '免费精洗车 免费代驾',
                      titleFontSize: 11,
                      subtitleFontSize: 8,
                      titleFontWeight: FontWeight.w600,
                      maxLines: 1,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
