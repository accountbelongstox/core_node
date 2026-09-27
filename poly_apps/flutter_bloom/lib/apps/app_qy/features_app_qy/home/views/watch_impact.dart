import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/watch_impact_data.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/views/play_video_screen.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/actions_widget.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:go_router/go_router.dart';

class WatchTheImpactScreen extends StatefulWidget {
  const WatchTheImpactScreen({super.key});

  @override
  State<WatchTheImpactScreen> createState() => _WatchTheImpactScreenState();
}

class _WatchTheImpactScreenState extends State<WatchTheImpactScreen> {
  @override
  Widget build(BuildContext context) {
    final watchImpacts = WatchImpactData.getMockWatchImpacts();
    return Scaffold(
        appBar: AppBar(
          title: Text(
            QyAppLocalizationKeys.qyHomeWatchImpact.tr(context),
            style: ThemeTextStyles.textSemiBold,
          ),
          actions: const [
            ActionWidget(
              actionIcon: Icon(
                Icons.more_vert,
                color: ColorsAppQy.qyTextOnPrimary,
              ),
            )
          ],
        ),
        body: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 0),
          child: GridView.builder(
              itemCount: watchImpacts.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, childAspectRatio: 4 / 5),
              itemBuilder: (_, index) {
                return InkWell(
                  onTap: () {
                    context.push('/qy/home/watch-impact/play');
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Stack(
                      children: [
                        ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.asset(
                              watchImpacts[index].watchImage,
                              height: 230,
                              fit: BoxFit.fitHeight,
                            )),
                        const Positioned(
                          top: 65,
                          left: 60,
                          child: Icon(
                            Icons.play_circle_outline,
                            color: ColorsAppQy.qyTextOnPrimary,
                            size: 50,
                          ),
                        ),
                        Positioned(
                            bottom: 30,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: ThemeDimensions.defaultSize),
                              child: Text(
                                watchImpacts[index].watchName,
                                style: ThemeTextStyles.textMedium
                                    .copyWith(color: ColorsAppQy.qyTextOnPrimary),
                              ),
                            )),
                      ],
                    ),
                  ),
                );
              }),
        ));
  }
}
