import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class InterestWidget extends StatelessWidget {
  final String interest;
  const InterestWidget({super.key, required this.interest});

  @override
  Widget build(BuildContext context) {
    return CustomCircular(
      outlineColor: ThemeColors.green,
      radius: ThemeDimensions.radiusBig,
      widget: Padding(
        padding: const EdgeInsets.symmetric(
            vertical: ThemeDimensions.paddingSizeExtraSmall,
            horizontal: ThemeDimensions.defaultSize),
        child: Text(
          interest,
          style: ThemeTextStyles.textMedium.copyWith(
              color: Colors.green, fontSize: ThemeDimensions.fontSizeDefault),
        ),
      ),
    );
  }
}
