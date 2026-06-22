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
import '../../../widgets_app_bank/bank_wealth_function_grid.dart';

class LifeServicesGrid extends StatelessWidget {
  const LifeServicesGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final lifeIcons = [
      WealthIconConfig(
        label: '手机话费',
        imagePath: BankImages.servicePhoneFee,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '电费',
        imagePath: BankImages.serviceElectric,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '医保码',
        imagePath: BankImages.serviceMedicalCode,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '低碳生活',
        imagePath: BankImages.serviceLowCarbon,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '电影演出',
        imagePath: BankImages.serviceMovie,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '智慧食堂',
        imagePath: BankImages.serviceCanteen,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '积分汇',
        imagePath: BankImages.servicePoints,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '党费',
        imagePath: BankImages.servicePartyFee,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '燃气费',
        imagePath: BankImages.serviceGas,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '水费',
        imagePath: BankImages.serviceWater,
        iconWidth: 32,
        iconHeight: 32,
      ),
    ];

    return BankWealthFunctionGrid(
      title: null,
      icons: lifeIcons,
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Colors.transparent,
          Colors.transparent,
        ],
      ),
      itemsPerRow: 5,
      border: Border.all(color: Colors.transparent, width: 0),
      boxShadow: [],
    );
  }
}
