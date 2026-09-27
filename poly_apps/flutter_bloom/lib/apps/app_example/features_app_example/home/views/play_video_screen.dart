import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
// import 'package:qyflutter/theme/assets_icons.dart';
import 'package:percent_indicator/percent_indicator.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';

class PlayVideoScreen extends StatelessWidget {
  const PlayVideoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Column(
        children: [
          const Image(
              image: AssetImage(
            CommonAssetsImages.baby1,
          )),
          const Spacer(),
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Video to play"),
                LinearPercentIndicator(
                    barRadius: const Radius.circular(10),
                    lineHeight: 8.0,
                    percent: 0.10,
                    progressColor: Theme.of(context).colorScheme.surfaceTint),
                const Padding(
                  padding:
                      EdgeInsets.symmetric(vertical: ThemeDimensions.defaultSize),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("0:32/10:52"),
                      Icon(
                        Icons.arrow_back_ios,
                        color: Colors.green,
                        size: 20,
                      ),
                      Icon(
                        Icons.play_circle_outline,
                        color: Colors.green,
                        size: 40,
                      ),
                      Icon(
                        Icons.arrow_forward_ios,
                        color: Colors.green,
                        size: 20,
                      ),
                      Icon(
                        Icons.volume_down_sharp,
                        color: Colors.green,
                        size: 30,
                      ),
                      Icon(
                        Icons.settings,
                        color: Colors.green,
                        size: 20,
                      ),
                    ],
                  ),
                )
              ],
            ),
          ),
          const SizedBox(
            height: ThemeDimensions.topSpace,
          ),
        ],
      ),
    );
  }
}
