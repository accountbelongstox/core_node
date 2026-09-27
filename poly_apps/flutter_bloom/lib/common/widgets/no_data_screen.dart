import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class NoDataScreen extends StatelessWidget {
  final String? title;
  final bool fromHome;
  const NoDataScreen({super.key, this.title, this.fromHome = false});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.paddingSizeLarge),
      child: Center(
        child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Image.asset(
                fromHome ? CommonAssetsIcons.initTrip : CommonAssetsIcons.noDataFound,
                width: 100,
                height: 100,
                color: fromHome ? null : Theme.of(context).primaryColor,
              ),
              Text(
                title != null
                    ? title!.tr(context)
                    : 'no_data_found'.tr(context),
                style: ThemeTextStyles.textRegular.copyWith(
                    color: Theme.of(context).primaryColor,
                    fontSize: MediaQuery.of(context).size.height * 0.023),
                textAlign: TextAlign.center,
              ),
            ]),
      ),
    );
  }
}
