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
import '../../../widgets_app_bank/bank_section_grid.dart';
import '../../../widgets_app_bank/bank_image_card.dart';
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';

class InstallmentSections {
  static Widget buildInstallmentBenefits(BuildContext context) {
    return BankSectionCard(
      title: '分期优享',
      padding: const EdgeInsets.only(left: 16, right: 16, top: 8, bottom: 8),
      borderRadius: BankConstants.borderRadius,
      titleBottomPadding: BankConstants.sectionTitleBottomPadding,
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFF1F8FE),
          Color(0xFFF1F8FE),
        ],
      ),
      children: [
        BankSectionGrid(
          crossAxisCount: 2,
          childAspectRatio: 2.67,
          children: [
            BankImageCard(
              imagePath: BankImages.installmentPass,
              title: '分期通',
              subtitle: '要消费,到建行',
              imageWidth: 36,
              imageHeight: 36,
              layoutDirection: BankImageCardLayoutDirection.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              backgroundColor: const Color(0xFFF6F6F6),
              border: Border.all(color: Colors.white, width: 1),
              onTap: () {
                BankLoadingDialog.show(context, title: '分期通');
              },
            ),
            BankImageCard(
              imagePath: BankImages.renovationInstallment,
              title: '装修分期',
              subtitle: '惠爱幸福家',
              imageWidth: 36,
              imageHeight: 36,
              layoutDirection: BankImageCardLayoutDirection.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              backgroundColor: const Color(0xFFF6F6F6),
              border: Border.all(color: Colors.white, width: 1),
              onTap: () {
                BankLoadingDialog.show(context, title: '装修分期');
              },
            ),
            BankImageCard(
              imagePath: BankImages.cashInstallment,
              title: '现金分期',
              subtitle: '申请便捷 期数灵活',
              imageWidth: 36,
              imageHeight: 36,
              layoutDirection: BankImageCardLayoutDirection.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              backgroundColor: const Color(0xFFF6F6F6),
              border: Border.all(color: Colors.white, width: 1),
              onTap: () {
                BankLoadingDialog.show(context, title: '现金分期');
              },
            ),
            BankImageCard(
              imagePath: BankImages.billInstallment,
              title: '账单分期',
              subtitle: '申请便捷 还款轻松',
              imageWidth: 36,
              imageHeight: 36,
              layoutDirection: BankImageCardLayoutDirection.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              backgroundColor: const Color(0xFFF6F6F6),
              border: Border.all(color: Colors.white, width: 1),
              onTap: () {
                BankLoadingDialog.show(context, title: '账单分期');
              },
            ),
          ],
        ),
      ],
    );
  }

  static Widget buildInstallmentShopping(BuildContext context) {
    return BankSectionCard(
      title: '分期购物',
      moreText: '更多',
      onMoreTap: () {
        BankLoadingDialog.show(context, title: '更多');
      },
      padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 16),
      titleBottomPadding: BankConstants.sectionTitleBottomPadding,
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFF1F8FE),
          Color(0xFFF1F8FE),
        ],
      ),
      children: [
        BankSectionGrid(
          crossAxisCount: 3,
          childAspectRatio: 1.2,
          children: [
            BankImageCard(
              imagePath: BankImages.appleInstallment,
              title: 'Apple 分期',
              subtitle: '至高24期分期购',
              imageWidth: 32,
              imageHeight: 32,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              onTap: () {
                BankLoadingDialog.show(context, title: 'Apple 分期');
              },
            ),
            BankImageCard(
              imagePath: BankImages.vipshopInstallment,
              title: '唯品会分期购',
              subtitle: '分期至高满减150元',
              imageWidth: 32,
              imageHeight: 32,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              onTap: () {
                BankLoadingDialog.show(context, title: '唯品会分期购');
              },
            ),
            BankImageCard(
              imagePath: BankImages.taobaoInstallment,
              title: '淘宝超值购物开启',
              subtitle: '淘宝超值购物开启',
              imageWidth: 32,
              imageHeight: 32,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              onTap: () {
                BankLoadingDialog.show(context, title: '淘宝超值购物开启');
              },
            ),
            BankImageCard(
              imagePath: BankImages.ctripInstallment,
              title: '携程分期购',
              subtitle: '至高满减300元',
              imageWidth: 32,
              imageHeight: 32,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              onTap: () {
                BankLoadingDialog.show(context, title: '携程分期购');
              },
            ),
            BankImageCard(
              imagePath: BankImages.xiaomiInstallment,
              title: '小米分期',
              subtitle: '分期至高满减216元',
              imageWidth: 32,
              imageHeight: 32,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              onTap: () {
                BankLoadingDialog.show(context, title: '小米分期');
              },
            ),
            BankImageCard(
              imagePath: BankImages.jdInstallment,
              title: '京东商城',
              subtitle: '至高24期分期购',
              imageWidth: 32,
              imageHeight: 32,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              onTap: () {
                BankLoadingDialog.show(context, title: '京东商城');
              },
            ),
          ],
        ),
      ],
    );
  }
}
