import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/domain/model/urgetnt_fundrasing_model.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'urgentfunding_widget.dart';

class FundRisingListView extends StatelessWidget {
  const FundRisingListView({super.key});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    return SizedBox(
      height: ThemeDimensions.onePointFiveWidth,
      child: ListView.builder(
          itemCount: urgentModelList.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) => UrgentFundraisingScreen(
              urgentFundingModel: urgentModelList[index])),
    );
  }
}
