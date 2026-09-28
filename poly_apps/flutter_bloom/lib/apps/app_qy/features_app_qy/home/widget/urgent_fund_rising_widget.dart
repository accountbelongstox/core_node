import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/fund_rising_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/urgetnt_fundrasing_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/sources/urgent_funding_data.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/sources/fund_rising_data.dart';
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
