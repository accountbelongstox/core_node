import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/setting/widgets/notification_setting_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class NotificationSettingScreen extends StatelessWidget {
  const NotificationSettingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text(
            "Notification",
            style: ThemeTextStyles.textMedium,
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Column(
            children: [
              CustomSettingCard(
                title: "Sound",
                icon: const Icon(Icons.toggle_off),
                ontap: () {},
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: CustomSettingCard(
                  title: "Vibrate",
                  icon: const Icon(
                    Icons.toggle_on,
                    color: Colors.green,
                  ),
                  ontap: () {},
                ),
              ),
              CustomSettingCard(
                title: "New trip available",
                icon: const Icon(Icons.toggle_off),
                ontap: () {},
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: CustomSettingCard(
                  title: "New service available",
                  icon: const Icon(
                    Icons.toggle_on,
                    color: Colors.green,
                  ),
                  ontap: () {},
                ),
              )
            ],
          ),
        ));
  }
}
