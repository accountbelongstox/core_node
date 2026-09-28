import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/prayer_model.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/prayer_widget.dart';

class PrayerListView extends StatelessWidget {
  const PrayerListView({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 230,
      child: ListView.builder(
          itemCount: prayerList.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) =>
              PrayerWidget(prayerModel: prayerList[index])),
    );
  }
}
