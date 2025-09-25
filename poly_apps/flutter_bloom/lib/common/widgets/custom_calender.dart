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
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart' hide Trans; // Hide GetX's Trans extension
import 'package:intl/intl.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:syncfusion_flutter_datepicker/datepicker.dart';
import 'package:go_router/go_router.dart';

class CustomCalender extends StatefulWidget {
  final Function(Object? text) onChanged;
  final Function()? onPress;
  const CustomCalender({super.key, required this.onChanged, this.onPress});

  @override
  State<CustomCalender> createState() => _CustomCalenderState();
}

class _CustomCalenderState extends State<CustomCalender> {
  String _range = '';

  void _onSelectionChanged(DateRangePickerSelectionChangedArgs args) {
    setState(() {
      if (args.value is PickerDateRange) {
        _range = '${DateFormat('yyyy-MM-d').format(args.value.startDate)}/'
            '${DateFormat('yyyy-MM-d').format(args.value.endDate ?? args.value.startDate)}';
      } else if (args.value is DateTime) {
      } else if (args.value is List<DateTime>) {
      } else {}
    });
  }

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    List<String> rng = _range.split('/');
    final DateRangePickerController controller = DateRangePickerController();
    DateTime? selectedDate;
    debugPrint(selectedDate.toString());
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: ThemeDimensions.paddingSizeDefault, vertical: 30),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.paddingSizeExtraLarge),
          color: Theme.of(context).canvasColor,
        ),
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
        child: Stack(
          children: [
            Column(
              children: [
                Padding(
                  padding: const EdgeInsets.only(
                      bottom: ThemeDimensions.paddingSizeLarge),
                  child: Card(
                      elevation: 0,
                      color: Colors.transparent,
                      child: Text(
                        'select_your_date'.tr(context),
                        style: ThemeTextStyles.textBold.copyWith(
                            fontSize: ThemeDimensions.fontSizeLarge),
                      )),
                ),
                Expanded(
                  child: SfDateRangePicker(
                    confirmText: 'apply'.tr(context),
                    showActionButtons: false,
                    cancelText: '',
                    onCancel: () => context.pop(),
                    onSubmit: widget.onChanged,
                    todayHighlightColor: Theme.of(context).primaryColor,
                    selectionMode: DateRangePickerSelectionMode.range,
                    rangeSelectionColor:
                        Theme.of(context).primaryColor.withOpacity(.25),
                    view: DateRangePickerView.month,
                    enableMultiView: true,
                    navigationDirection:
                        DateRangePickerNavigationDirection.vertical,
                    startRangeSelectionColor: Theme.of(context).primaryColor,
                    endRangeSelectionColor:
                        Theme.of(context).colorScheme.onTertiaryContainer,
                    initialSelectedRange: PickerDateRange(
                        DateTime.now().subtract(const Duration(days: 2)),
                        DateTime.now().add(const Duration(days: 2))),
                    onSelectionChanged: _onSelectionChanged,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 50),
                  child: Card(
                    color: Colors.transparent,
                    elevation: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: ThemeDimensions.paddingSizeDefault,
                          vertical: ThemeDimensions.paddingSizeSmall),
                      decoration: BoxDecoration(
                          color: Theme.of(context).primaryColor,
                          borderRadius: BorderRadius.circular(100)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                              width: ThemeDimensions.iconSizeSmall,
                              child: Image.asset(CommonAssetsIcons.calender)),
                          const SizedBox(
                              width: ThemeDimensions.paddingSizeExtraSmall),
                          Text(
                            rng.length > 1 ? rng[0] : 'select'.tr(context),
                            style: ThemeTextStyles.textRegular.copyWith(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 50),
                  child: Card(
                    color: Colors.transparent,
                    elevation: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: ThemeDimensions.paddingSizeDefault,
                          vertical: ThemeDimensions.paddingSizeSmall),
                      decoration: BoxDecoration(
                          color:
                              Theme.of(context).colorScheme.onTertiaryContainer,
                          borderRadius: BorderRadius.circular(100)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                              width: ThemeDimensions.iconSizeSmall,
                              child: Image.asset(CommonAssetsIcons.calender)),
                          const SizedBox(
                              width: ThemeDimensions.paddingSizeExtraSmall),
                          Text(
                            rng.length > 1 ? rng[1] : 'select'.tr(context),
                            style: ThemeTextStyles.textRegular.copyWith(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(
                  height: 40,
                ),
                CustomButton(
                  radius: ThemeDimensions.paddingSizeExtraLarge,
                  onPressed: () {
                    selectedDate = controller.selectedDate;
                  },
                  buttonText: 'apply'.tr(context),
                ),
              ],
            ),
            Positioned(
                child: Align(
                    alignment: Alignment.topRight,
                    child: GestureDetector(
                        onTap: () => Get.back(),
                        child: Icon(
                          Icons.clear,
                          size: ThemeDimensions.iconSizeMedium,
                          color: Theme.of(context)
                              .textTheme
                              .bodyLarge!
                              .color!
                              .withOpacity(.5),
                        ))))
          ],
        ),
      ),
    );
  }
}
