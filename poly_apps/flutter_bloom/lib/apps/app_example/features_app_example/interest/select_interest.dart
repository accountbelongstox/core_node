import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/apps/app_example/features_app_example/authentication/views/create_pin_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/profile/domain/model/select_insterest_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class SelectInsterestScreenView extends StatelessWidget {
  const SelectInsterestScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).cardColor,
      appBar: const CustomAppBar(title: "Select Your Interest"),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeExtraSmall),
        child: Column(
          children: [
            const Text(
              "Choose your interest to donate.Don't worry, you can always change it latter",
              style: ThemeTextStyles.textSemiBold,
            ),
            Expanded(
                child: Padding(
              padding: const EdgeInsets.symmetric(
                  vertical: ThemeDimensions.paddingSizeSmall),
              child: GridView.builder(
                  itemCount: interestList.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                  ),
                  itemBuilder: (_, index) {
                    return Padding(
                        padding: const EdgeInsets.all(3.0),
                        child: Card(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                mainAxisAlignment: MainAxisAlignment.start,
                                children: [
                              const SizedBox(
                                height: 20,
                              ),
                              Image.asset(
                                interestList[index].image,
                                height: 50,
                                fit: BoxFit.cover,
                              ),
                              Text(interestList[index].title)
                            ])));
                  }),
            )),
            Align(
                alignment: Alignment.bottomCenter,
                child: CustomButton(
                    onPressed: () {
                      Get.to(const CreatePinScreen());
                    },
                    radius: ThemeDimensions.radiusBig,
                    backgroundColor: Theme.of(context).colorScheme.surfaceTint,
                    borderColor: Theme.of(context).colorScheme.surfaceTint,
                    height: ThemeDimensions.largeExtraSize,
                    width: double.infinity,
                    buttonText: "Continue")),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            )
          ],
        ),
      ),
    );
  }
}
