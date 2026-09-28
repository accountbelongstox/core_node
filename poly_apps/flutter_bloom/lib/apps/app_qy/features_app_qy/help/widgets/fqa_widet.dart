import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import '../../../resources_app_qy/colors_app_qy.dart';

class FqaWidget extends StatelessWidget {
  final String fqaName;
  const FqaWidget({super.key, required this.fqaName});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          const EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSizeSeven),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultSize),
          border: Border.all(width: 1.5, color: ColorsAppQy.qyBorderLight),
        ),
        child: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                fqaName,
                style: ThemeTextStyles.contentSubtitle,
              ),
              Icon(
                Icons.arrow_drop_down,
                color: Theme.of(context).colorScheme.surfaceTint,
              )
            ],
          ),
        ),
      ),
    );
  }
}
