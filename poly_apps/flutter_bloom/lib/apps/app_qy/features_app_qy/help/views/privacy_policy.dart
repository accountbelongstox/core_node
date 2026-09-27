import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/help/model/help_data_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class PrivacyScreenView extends StatelessWidget {
  const PrivacyScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        forceMaterialTransparency: true,
        title: Text(
          'Privacy Policy',
          style: ThemeTextStyles.appNavigation,
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Introduction",
                style: ThemeTextStyles.contentSubtitle.copyWith(fontSize: ThemeDimensions.fontSizeLarge),
              ),
              const SizedBox(
                height: ThemeDimensions.defaultSize,
              ),
              Text(
                privacyIntroduction,
                style: ThemeTextStyles.contentBody,
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: Text(
                  "Accessing the service",
                  style:
                      ThemeTextStyles.contentSubtitle.copyWith(fontSize: ThemeDimensions.fontSizeLarge),
                ),
              ),
              Text(
                privacyAccessing,
                style: ThemeTextStyles.contentBody,
              )
            ],
          ),
        ),
      ),
    );
  }
}
