import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/banner_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';

class BannerWidget extends StatelessWidget {
  const BannerWidget({super.key});

  @override
  Widget build(BuildContext context) {
    PageController pageController = PageController();
    return Padding(
      padding:
          const EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSizeDefault),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: Theme.of(context).cardColor,
        ),
        height: ThemeDimensions.bigExtraSize,
        child: Stack(children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: PageView.builder(
              itemCount: sliderImage.length,
              controller: pageController,
              itemBuilder: (_, index) {
                return ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Image.asset(
                      sliderImage[index],
                      fit: BoxFit.cover,
                    ));
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Align(
              alignment: Alignment.bottomCenter,
              child: SmoothPageIndicator(
                  controller: pageController, // PageController
                  count: sliderImage.length,
                  effect: WormEffect(
                    dotHeight: 8,
                    dotWidth: 8,
                    dotColor: Theme.of(context).hintColor,
                    activeDotColor: Theme.of(context).colorScheme.surfaceTint,
                  ),
                  onDotClicked: (index) {}),
            ),
          ),
        ]),
      ),
    );
  }
}
