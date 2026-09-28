import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/prayer_widget.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/prayer_data.dart';

class PrayerListView extends StatelessWidget {
  const PrayerListView({super.key});

  @override
  Widget build(BuildContext context) {
    final prayers = PrayerData.getMockPrayers();
    return SizedBox(
      height: 230,
      child: ListView.builder(
          itemCount: prayers.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) =>
              PrayerWidget(prayerModel: prayers[index])),
    );
  }
}
