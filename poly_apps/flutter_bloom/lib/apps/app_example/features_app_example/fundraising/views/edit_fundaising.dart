import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/apps/app_example/features_app_example/fundraising/widget/card_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class EditFundraisingScreen extends StatelessWidget {
  const EditFundraisingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Fundraising'), actions: <Widget>[
        IconButton(
            icon: const Icon(
              Icons.delete,
              color: Colors.red,
            ),
            onPressed: () {})
      ]),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: SingleChildScrollView(
          scrollDirection: Axis.vertical,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                  decoration: BoxDecoration(
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.defaultSize)),
                  child: ClipRRect(
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.defaultSize),
                      child: Image.asset(CommonAssetsIcons.education))),
              const SizedBox(
                height: ThemeDimensions.sizeFifteen,
              ),
              const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    FundaisingSubImageWidget(),
                    FundaisingSubImageWidget(),
                    FundaisingSubImageWidget(),
                  ]),
              Padding(
                  padding: const EdgeInsets.symmetric(
                      vertical: ThemeDimensions.defaultSize),
                  child: Text("Fundraising Details",
                      style: ThemeTextStyles.textBold.copyWith(fontSize: 18))),
              const Text('  Title'),
              const CustomTextField(
                showCountryCode: false,
              ),
              const SizedBox(
                height: ThemeDimensions.defaultSize,
              ),
              const Text('  Category'),
              const CustomTextField(
                showCountryCode: false,
              ),
              const SizedBox(
                height: ThemeDimensions.defaultSize,
              ),
              const Text('  Total Donations Required'),
              const CustomTextField(
                showCountryCode: false,
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: ThemeDimensions.defaultSize),
                child: CustomButton(
                    radius: ThemeDimensions.radiusBig,
                    backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                    buttonText: "Update & Submit"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
