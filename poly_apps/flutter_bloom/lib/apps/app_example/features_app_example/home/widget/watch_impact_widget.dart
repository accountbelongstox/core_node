import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/wacth_impact_model.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/views/play_video_screen.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:get/get.dart';

class WatchImpactWidget extends StatelessWidget {
  final WatchImpactModel? watchImpactModel;
  const WatchImpactWidget({super.key, this.watchImpactModel});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: InkWell(
        onTap: () {
          Get.to(const PlayVideoScreen());
        },
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Image.asset(
                watchImpactModel?.watchImage ?? '',
                fit: BoxFit.cover,
              ),
            ),
            const Positioned(
              top: 80,
              left: 120,
              child: Icon(
                Icons.play_circle_outline,
                color: Colors.green,
                size: 50,
              ),
            ),
            Positioned(
                bottom: 20.0,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.defaultSize),
                  child: Text(
                    watchImpactModel?.watchName ?? '',
                    style:
                        ThemeTextStyles.textMedium.copyWith(color: Theme.of(context).cardColor),
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
