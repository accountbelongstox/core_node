import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/setting/widgets/notification_setting_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class SecuritySettingScreen extends StatelessWidget {
  const SecuritySettingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text(
            "Security",
            style: ThemeTextStyles.textSemiBold,
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Column(
            children: [
              const CustomSettingCard(
                  title: "Face ID",
                  icon: Icon(
                    Icons.toggle_on,
                    color: Colors.green,
                    size: 30,
                  )),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: ThemeDimensions.defaultSize),
                child: CustomSettingCard(
                    title: "Remember me",
                    icon: Icon(
                      Icons.toggle_on_outlined,
                      color: Colors.grey,
                      size: 30,
                    )),
              ),
              const CustomSettingCard(
                  title: "Touch ID",
                  icon: Icon(Icons.toggle_on, color: Colors.green, size: 30)),
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.paddingSizeExtraLarge),
                child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusBig),
                      border: Border.all(
                        width: 1.5,
                        color: Theme.of(context).colorScheme.surfaceTint,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: ThemeDimensions.sizeFifteen),
                      child: Center(
                        child: Text(
                          "Change Password",
                          style: ThemeTextStyles.primaryButton,
                        ),
                      ),
                    )),
              ),
              Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusBig),
                    border: Border.all(
                      width: 1.5,
                      color: Theme.of(context).colorScheme.surfaceTint,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        vertical: ThemeDimensions.sizeFifteen),
                    child: Center(
                      child: Text(
                        "Change PIN",
                        style: ThemeTextStyles.primaryButton,
                      ),
                    ),
                  )),
            ],
          ),
        ));
  }
}
