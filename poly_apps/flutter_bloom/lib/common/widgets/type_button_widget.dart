import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class TypeButtonWidget extends StatelessWidget {
  final int index;
  final String name;
  final Function()? onTap;
  final int selectedIndex;
  final double? cardWidth;
  const TypeButtonWidget(
      {super.key,
      required this.index,
      required this.name,
      this.onTap,
      required this.selectedIndex,
      this.cardWidth});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeExtraSmall),
        child: Container(
          width: cardWidth ?? MediaQuery.of(context).size.width / 2.5,
          padding: const EdgeInsets.all(ThemeDimensions.paddingSizeSmall),
          decoration: BoxDecoration(
            border: Border.all(
                width: .5,
                color: index == selectedIndex
                    ? Theme.of(context).colorScheme.onSecondary
                    : Theme.of(context).primaryColor),
            color: index == selectedIndex
                ? Theme.of(context).primaryColor
                : Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(ThemeDimensions.paddingSizeSmall),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 5),
                child: Text(name.tr(context),
                    textAlign: TextAlign.center,
                    style: ThemeTextStyles.textSemiBold.copyWith(
                        color: index == selectedIndex
                            ? Colors.white
                            : Theme.of(context).hintColor.withOpacity(.65),
                        fontSize: ThemeDimensions.fontSizeLarge)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
