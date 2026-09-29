import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class InterestWidget extends StatelessWidget {
  final String interest;
  const InterestWidget({super.key, required this.interest});

  @override
  Widget build(BuildContext context) {
    return CustomCircular(
      outlineColor: ColorsAppQy.qyPrimary,
      radius: ThemeDimensions.radiusBig,
      widget: Padding(
        padding: const EdgeInsets.symmetric(
            vertical: ThemeDimensions.paddingSizeExtraSmall,
            horizontal: ThemeDimensions.defaultSize),
        child: Text(
          interest,
          style: ThemeTextStyles.textMedium.copyWith(
              color: ColorsAppQy.qyPrimary, fontSize: ThemeDimensions.fontSizeDefault),
        ),
      ),
    );
  }
}
