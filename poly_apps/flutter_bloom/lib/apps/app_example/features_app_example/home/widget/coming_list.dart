import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/comingto_model.dart';

import 'coming_widget.dart';

class ComingListView extends StatelessWidget {
  const ComingListView({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 290,
      child: ListView.builder(
          itemCount: comingModelList.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) {
            final model = comingModelList[index];
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
