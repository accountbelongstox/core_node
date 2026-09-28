import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/domain/model/comingto_model.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/data/coming_end_data.dart';

import 'coming_widget.dart';

class ComingListView extends StatelessWidget {
  const ComingListView({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final comingEnds = ComingEndData.getMockComingEnds();
    return SizedBox(
      height: 290,
      child: ListView.builder(
          itemCount: comingEnds.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) {
            final model = comingEnds[index];
            return ComingEndWidget(
              comingEndModel: ComingEndModel(
                days: model.days ?? '',
                percent: model.percent ?? 0.0,
                found: model.found ?? '',
                donat: model.donat ?? '',
                image: model.image ?? '',
                title: model.title ?? '',
              ),
            );
          }),
    );
  }
}
