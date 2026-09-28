import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/watch_impact_data.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/watch_impact_widget.dart';

class WatchImpactList extends StatelessWidget {
  const WatchImpactList({super.key});

  @override
  Widget build(BuildContext context) {
    final watchImpacts = WatchImpactData.getMockWatchImpacts();
    return SizedBox(
      height: 200,
      child: ListView.builder(
          itemCount: watchImpacts.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) =>
              WatchImpactWidget(watchImpactModel: watchImpacts[index])),
    );
  }
}
