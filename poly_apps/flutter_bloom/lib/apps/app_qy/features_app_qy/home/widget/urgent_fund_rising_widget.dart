// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/fund_rising_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/urgetnt_fundrasing_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/urgent_funding_data.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/fund_rising_data.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class UrgentFundRisingWidget extends StatefulWidget {
  const UrgentFundRisingWidget({super.key});

  @override
  State<UrgentFundRisingWidget> createState() => _UrgentFundRisingWidgetState();
}

class _UrgentFundRisingWidgetState extends State<UrgentFundRisingWidget> {
  int selectedIndex = 0;
  void setSelectedIndex(int index) {
    setState(() {
      selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final types = FundRisingData.getFundRisingTypes();
    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: ThemeDimensions.paddingSizeLarge),
      child: SizedBox(
          height: 35,
          child: ListView.builder(
              shrinkWrap: true,
              itemCount: types.length,
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.zero,
              itemBuilder: (context, index) {
                return FundRisingTypeItem(
                  index: index,
                  selectedIndex: selectedIndex,
                  typeKey: types[index],
                  onTap: () {
                    setState(() {
                      selectedIndex = index;
                    });
                  },
                );
              })),
    );
  }
}

class FundRisingTypeItem extends StatelessWidget {
  final int index;
  final int selectedIndex;
  final String typeKey;
  final Function()? onTap;
  const FundRisingTypeItem({
    super.key,
    this.onTap,
    required this.index,
    required this.selectedIndex,
    required this.typeKey,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: ThemeDimensions.paddingSizeDefault),
      child: InkWell(
          onTap: onTap,
          child: Container(
              padding: const EdgeInsets.symmetric(
                  vertical: ThemeDimensions.paddingSizeExtraSmall,
                  horizontal: ThemeDimensions.paddingSizeDefault),
              decoration: BoxDecoration(
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.paddingSizeDefault),
                  color: index == selectedIndex
                      ? Theme.of(context).colorScheme.surfaceTint
                      : Theme.of(context).cardColor,
                  border: Border.all(
                      width: 1.5,
                      color: index == selectedIndex
                          ? Theme.of(context).colorScheme.surfaceTint
                          : Theme.of(context).colorScheme.surfaceTint)),
              child: Center(
                  child: Text(
                typeKey.tr(context),
                style: ThemeTextStyles.textMedium.copyWith(
                  color: index == selectedIndex
                      ? Theme.of(context).cardColor
                      : ColorsAppQy.qyTextPrimary,
                ),
              )))),
    );
  }
}
