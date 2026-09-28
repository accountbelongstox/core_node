import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class ContactScreenView extends StatelessWidget {
  const ContactScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Contact us', style: ThemeTextStyles.textMedium)),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Padding(padding: EdgeInsets.all(8.0), child: Text('Name')),
            const CustomTextField(
              showBorder: true,
              hintText: "Name",
              showCountryCode: false,
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Padding(padding: EdgeInsets.all(8.0), child: Text('Email')),
            const CustomTextField(
              showBorder: true,
              hintText: "email",
              showCountryCode: false,
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Padding(
                padding: EdgeInsets.all(8.0), child: Text('  Massage')),
            const CustomTextField(
              showBorder: true,
              hintText: "Massage",
              maxLines: 6,
              borderRadius: ThemeDimensions.defaultSize,
              showCountryCode: false,
            ),
            const Spacer(),
            Align(
                alignment: Alignment.bottomCenter,
                child: CustomButton(
                    buttonText: "Sand Massage",
                    radius: ThemeDimensions.radiusBig,
                    backgroundColor:
                        Theme.of(context).colorScheme.surfaceTint)),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            )
          ],
        ),
      ),
    );
  }
}
