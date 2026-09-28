import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class CustomHomeTitle extends StatelessWidget {
  final String title;
  final Function()? onTap;
  const CustomHomeTitle({super.key, required this.title, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: ThemeTextStyles.contentSubtitle),
        InkWell(
            onTap: onTap,
            child: Text(
              "see_all".tr(context),
              style: ThemeTextStyles.contentBody.copyWith(color: ThemeColors.primaryBrand),
            )),
      ],
    );
  }
}
