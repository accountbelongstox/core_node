import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class AddNewCardScreen extends StatelessWidget {
  const AddNewCardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Add New Card',
          style: ThemeTextStyles.textBold,
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: ThemeDimensions.bigExtraSize,
              width: double.maxFinite,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: Colors.green,
              ),
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Card Name",
                        style: ThemeTextStyles.textBold.copyWith(
                            fontSize: 24, color: Colors.white)),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: ThemeDimensions.sizeFifteen),
                      child: Center(
                          child: Text("125364 59716 45861",
                              style: ThemeTextStyles.textBold.copyWith(
                                  fontSize: 24, color: Colors.white))),
                    ),
                    const Spacer(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("Active Card",
                            style: ThemeTextStyles.textBold.copyWith(
                                fontSize: 24,
                                color: Colors.white,
                                fontStyle: FontStyle.italic)),
                        const Icon(
                          Icons.toggle_on,
                          size: 60,
                          color: Colors.white,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Text("  Full Name"),
            const CustomCircular(
              radius: ThemeDimensions.radiusBig,
              height: 50,
              outlineColor: Colors.green,
              widget: Padding(
                padding:
                    EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
                child: TextField(
                  decoration: InputDecoration(hintText: " Full name"),
                ),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Text("  Card Number"),
            const CustomCircular(
              radius: ThemeDimensions.radiusBig,
              height: 50,
              outlineColor: Colors.green,
              widget: Padding(
                padding:
                    EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
                child: TextField(
                  decoration: InputDecoration(hintText: " Card Number"),
                ),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Text("  Expiry Date"),
            const CustomCircular(
              radius: ThemeDimensions.radiusBig,
              height: 50,
              outlineColor: Colors.green,
              widget: Padding(
                padding:
                    EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
                child: TextField(
                  decoration: InputDecoration(hintText: " Expiry Date"),
                ),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.defaultSize,
            ),
            const Text("  CVV"),
            const CustomCircular(
              radius: ThemeDimensions.radiusBig,
              height: 50,
              outlineColor: Colors.green,
              widget: Padding(
                padding:
                    EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
                child: TextField(
                  decoration: InputDecoration(hintText: " CVV"),
                ),
              ),
            ),
            const SizedBox(
              height: ThemeDimensions.sizeFifteen,
            ),
            CustomButton(
              height: ThemeDimensions.paddingSizeOver,
              buttonText: "Add Card",
              onPressed: () {},
              radius: ThemeDimensions.radiusBig,
              backgroundColor: Theme.of(context).colorScheme.surfaceTint,
            )
          ],
        ),
      ),
    );
  }
}
