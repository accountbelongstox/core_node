import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class FollowerCardWidget extends StatelessWidget {
  final String followers;
  const FollowerCardWidget({super.key, required this.followers});

  @override
  Widget build(BuildContext context) {
    return CustomCircular(
      radius: ThemeDimensions.defaultSize,
      outlineColor: Theme.of(context).hoverColor,
      widget: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.sizeFifteen),
        child: Column(
          children: [
            Text(
              followers,
              style: ThemeTextStyles.contentSubtitle,
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            Text(
              "Followers",
              style: ThemeTextStyles.contentDetail,
            ),
          ],
        ),
      ),
    );
  }
}
