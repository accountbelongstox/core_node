import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/country_picker.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/profile/views/profile_screen.dart';
import 'package:get/get.dart';

class SelectCountryScreen extends StatefulWidget {
  const SelectCountryScreen({super.key});

  @override
  State<SelectCountryScreen> createState() => _SelectCountryScreenState();
}

class _SelectCountryScreenState extends State<SelectCountryScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        backgroundColor: Theme.of(context).cardColor,
        appBar: const CustomAppBar(
          title: "Select Your Country",
        ),
        body: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
          child: Column(
            children: [
              const CodePickerWidget(),
              const Spacer(),
              CustomButton(
                radius: ThemeDimensions.radiusBig,
                backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                borderColor: Theme.of(context).colorScheme.surfaceTint,
                height: ThemeDimensions.largeExtraSize,
                width: double.infinity,
                buttonText: "Continue",
                onPressed: () {
                  Get.to(ProfileScreenView());
                },
              ),
            ],
          ),
        ));
  }
}
