import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:get/get.dart';

void showCustomSnackBar(String? message,
    {bool isError = true, double margin = ThemeDimensions.paddingSizeSmall}) {
  ThemeDimensions.refresh(Get.context!);
  if (message != null && message.isNotEmpty) {
    Get.showSnackbar(GetSnackBar(
      backgroundColor: isError ? Colors.red : Colors.green,
      message: message,
      duration: const Duration(seconds: 2),
      snackStyle: SnackStyle.FLOATING,
      margin: EdgeInsets.only(
          top: ThemeDimensions.paddingSizeSmall,
          left: ThemeDimensions.paddingSizeSmall,
          right: ThemeDimensions.paddingSizeSmall,
          bottom: margin),
      borderRadius: ThemeDimensions.radiusSmall,
      isDismissible: true,
      dismissDirection: DismissDirection.horizontal,
    ));
  }
}
