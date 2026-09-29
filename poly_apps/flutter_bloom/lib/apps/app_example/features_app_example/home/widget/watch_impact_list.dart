import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/wacth_impact_model.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/watch_impact_widget.dart';

class WatchImpactList extends StatelessWidget {
  const WatchImpactList({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 200,
      child: ListView.builder(
          itemCount: watchImpactList.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) =>
              WatchImpactWidget(watchImpactModel: watchImpactList[index])),
    );
  }
}
