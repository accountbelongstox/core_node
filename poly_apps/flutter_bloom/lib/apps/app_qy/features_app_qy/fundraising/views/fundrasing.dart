import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

import 'package:percent_indicator/linear_percent_indicator.dart';

class Fundraising extends StatelessWidget {
  Fundraising({super.key});
  final List donationsList = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Expanded(
          child: ListView.builder(
              itemCount: donationsList.length,
              itemBuilder: (_, index) {
                return Card(
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              height: ThemeDimensions.bigSize,
                              width: ThemeDimensions.bigSize,
                              decoration: const BoxDecoration(
                                  color: Colors.grey,
                                  borderRadius: BorderRadius.only(
                                      topLeft: Radius.circular(
                                          ThemeDimensions.radiusLarge),
                                      bottomLeft: Radius.circular(
                                          ThemeDimensions.radiusLarge))),
                            ),
                            const SizedBox(
                              width: ThemeDimensions.paddingSizeDefault,
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "  Help victims of Flash",
                                    style: ThemeTextStyles.textBold,
                                  ),
                                  const SizedBox(
                                    height: 10,
                                  ),
                                  Text(
                                    "  102510,fund reusing from the ",
                                    style: ThemeTextStyles.textMedium,
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        vertical: ThemeDimensions.defaultSize),
                                    child: LinearPercentIndicator(
                                      barRadius: const Radius.circular(10),
                                      lineHeight: 8.0,
                                      percent: 0.10,
                                      progressColor: Theme.of(context)
                                          .colorScheme
                                          .surfaceTint,
                                    ),
                                  ),
                                  const Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text("  14580 Donations"),
                                      Text("  12/02/2000")
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text("14580 Donations"),
                            CustomCircular(
                              radius: ThemeDimensions.radiusBig,
                              outlineColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              widget: const Padding(
                                padding: EdgeInsets.symmetric(
                                    vertical: 5, horizontal: 10),
                                child: Text("Donate Again"),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              })),
    );
  }
}
