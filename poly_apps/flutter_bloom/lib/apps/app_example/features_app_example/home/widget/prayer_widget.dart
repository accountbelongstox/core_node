import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/prayer_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class PrayerWidget extends StatelessWidget {
  final PrayerModel? prayerModel;
  const PrayerWidget({super.key, this.prayerModel});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(ThemeDimensions.paddingSizeDefault, 5,
          ThemeDimensions.paddingSizeDefault, ThemeDimensions.paddingSizeDefault),
      child: Container(
        width: MediaQuery.of(context).size.width * .75,
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultSize),
            border: Border.all(
                color: Theme.of(context).hintColor.withOpacity(0.5),
                width: 0.5)),
        child: Padding(
          padding: const EdgeInsets.all(ThemeDimensions.defaultSize),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: ThemeDimensions.sizeTwentyFive,
                  backgroundImage: AssetImage(prayerModel?.userImage ?? ''),
                ),
                const SizedBox(
                  width: ThemeDimensions.defaultSize,
                ),
                Expanded(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            prayerModel?.name ?? '',
                            style: ThemeTextStyles.prayerTitle.copyWith(
                                fontSize: 18, color: Colors.black),
                          ),
                          Text(
                            "Today",
                            style: ThemeTextStyles.contentDetail,
                          ),
                        ],
                      ),
                      const Icon(
                        Icons.more_vert,
                        color: Colors.green,
                      ),
                    ],
                  ),
                )
              ],
            ),
            Divider(
              color: Theme.of(context).highlightColor,
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: ThemeDimensions.defaultSize),
              child: Text(
                prayerModel?.prayer ?? '',
                style: ThemeTextStyles.prayerContent,
              ),
            ),
            const Spacer(),
            const Row(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                Icon(
                  Icons.favorite_border,
                  color: Colors.red,
                ),
                SizedBox(
                  width: ThemeDimensions.defaultSize,
                ),
                Text("Aamiin"),
                SizedBox(width: ThemeDimensions.sizeTwenty),
                Icon(
                  Icons.share,
                  color: Colors.green,
                ),
                SizedBox(
                  width: ThemeDimensions.defaultSize,
                ),
                Text("Share"),
              ],
            )
          ]),
        ),
      ),
    );
  }
}
