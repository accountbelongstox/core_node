import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/fund_rising_model.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/urgetnt_fundrasing_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

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
    return Padding(
      padding:
          const EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSizeLarge),
      child: SizedBox(
          height: 35,
          child: ListView.builder(
              shrinkWrap: true,
              itemCount: urgentModelList.length,
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.zero,
              itemBuilder: (context, index) {
                return FundRisingTypeItem(
                  index: index,
                  selectedIndex: selectedIndex,
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
  final Function()? onTap;
  const FundRisingTypeItem(
      {super.key,
      this.onTap,
      required this.index,
      required this.selectedIndex});

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
                  child: Text(typeList[index],
                      style: ThemeTextStyles.textMedium.copyWith(
                        color: index == selectedIndex
                            ? Theme.of(context).cardColor
                            : Colors.black,
                        // Theme.of(context).hintColor
                      ))))),
    );
  }
}
