import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class SettingWidget extends StatelessWidget {
  final Icon icon;
  final String settingTitle;
  final Color? backgroundColor;
  final Icon? trailingIcon;
  final Function()? onTap;
  const SettingWidget(
      {super.key,
      required this.icon,
      required this.settingTitle,
      this.trailingIcon,
      this.onTap,
      this.backgroundColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(ThemeDimensions.defaultSize),
              border: Border.all(
                  width: 1.5,
                  color: Colors.grey.withValues(
                      red: 128, green: 128, blue: 128, alpha: 0.1))),
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(children: [
                  CircleAvatar(
                      radius: ThemeDimensions.sizeTwenty,
                      backgroundColor: backgroundColor ??
                          Theme.of(context).colorScheme.tertiary,
                      child: icon),
                  const SizedBox(
                    width: ThemeDimensions.defaultSize,
                  ),
                  Text(settingTitle,
                      style: ThemeTextStyles.textMedium.copyWith(
                          fontSize: ThemeDimensions.fontSizeDefault))
                ]),
                Icon(
                  Icons.arrow_forward_ios,
                  color: Theme.of(context).primaryColor,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
