import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/sources/urgent_funding_data.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'urgentfunding_widget.dart';

class FundRisingListView extends StatelessWidget {
  const FundRisingListView({super.key});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    final urgentFundings = UrgentFundingData.getMockUrgentFundings();
    return SizedBox(
      height: ThemeDimensions.onePointFiveWidth,
      child: ListView.builder(
          itemCount: urgentFundings.length,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) => UrgentFundraisingScreen(
              urgentFundingModel: urgentFundings[index])),
    );
  }
}
