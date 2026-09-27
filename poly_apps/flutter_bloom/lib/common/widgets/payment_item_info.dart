import 'package:flutter/material.dart';
import 'package:qyflutter/common/utils/common/price_converter.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class PaymentItemInfo extends StatelessWidget {
  final String? icon;
  final String title;
  final double amount;
  final bool isSubTotal;
  final bool isFromTripDetails;
  final String? paymentType;
  final bool discount;
  const PaymentItemInfo(
      {super.key,
      required this.title,
      this.icon,
      required this.amount,
      this.isSubTotal = false,
      this.isFromTripDetails = false,
      this.paymentType,
      this.discount = false});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: ThemeDimensions.paddingSizeSmall),
      child: Row(
        children: [
          if (icon != null)
            SizedBox(
                width: ThemeDimensions.iconSizeSmall, child: Image.asset(icon!)),
          if (icon != null) const SizedBox(width: ThemeDimensions.paddingSizeSmall),
          Expanded(
              child: icon != null
                  ? Text(title,
                      style: ThemeTextStyles.textMedium.copyWith(
                          color: Theme.of(context).primaryColor))
                  : Text(title,
                      style: ThemeTextStyles.textBold.copyWith(
                          color: Theme.of(context).primaryColor))),
          isSubTotal || isFromTripDetails
              ? Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.paddingSizeSmall,
                      vertical: ThemeDimensions.paddingSizeExtraSmall),
                  decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor.withOpacity(.15),
                      borderRadius: BorderRadius.circular(
                          ThemeDimensions.paddingSizeExtraSmall)),
                  child: Text(PriceConverter.convertPrice(amount),
                                              style: ThemeTextStyles.textSemiBold.copyWith(
                            color: Get.isDarkMode
                                ? Colors.white
                                : Theme.of(context).primaryColorDark)))
              : paymentType != null
                  ? Text(paymentType!,
                      style: ThemeTextStyles.textRegular.copyWith(
                          color: Theme.of(context).primaryColor))
                  : discount
                      ? Text('-${PriceConverter.convertPrice(amount)}',
                          style: ThemeTextStyles.textRegular.copyWith(
                              color: Get.isDarkMode
                                  ? Colors.white
                                  : Theme.of(context).hintColor))
                      : Text(PriceConverter.convertPrice(amount),
                          style: ThemeTextStyles.textRegular.copyWith(
                              color: Get.isDarkMode
                                  ? Colors.white
                                  : Theme.of(context).hintColor)),
        ],
      ),
    );
  }
}
