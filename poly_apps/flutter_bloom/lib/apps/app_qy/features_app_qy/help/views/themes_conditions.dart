import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/help/model/help_data_model.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class TermsEndConditionScreenView extends StatelessWidget {
  const TermsEndConditionScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Terms End Condition",
          style: ThemeTextStyles.title1,
        ),
      ),
      body: SingleChildScrollView(
        scrollDirection: Axis.vertical,
        child: Padding(
          padding: ThemeDimensions.paddingM,
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  "Terms End Condition",
                  style: ThemeTextStyles.title2Bold,
                ),
                SizedBox(
                  height: ThemeDimensions.spacing16,
                ),
                Text(
                  introduction,
                  style: ThemeTextStyles.body.copyWith(letterSpacing: 1.3),
                ),
                SizedBox(
                  height: ThemeDimensions.spacing20,
                ),
                Text(
                  'Accessing the service',
                  style: ThemeTextStyles.title3Bold,
                ),
                SizedBox(
                  height: ThemeDimensions.spacing16,
                ),
                Text(
                  accessing,
                  style: ThemeTextStyles.body.copyWith(letterSpacing: 1.3),
                ),
                SizedBox(
                  height: ThemeDimensions.spacing16,
                ),
              ]),
        ),
      ),
    );
  }
}
