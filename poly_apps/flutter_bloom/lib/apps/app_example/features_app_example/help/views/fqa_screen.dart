import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/apps/app_example/features_app_example/help/widgets/fqa_widet.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class FqaScreenView extends StatelessWidget {
  const FqaScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Text(
            'Faq',
            style: ThemeTextStyles.appNavigation,
          ),
        ),
        body: const Padding(
          padding: EdgeInsets.all(ThemeDimensions.defaultSize),
          child: Column(
            children: [
              UrgentFundRisingWidget(),
              FqaWidget(
                fqaName: "How to use wecare ?",
              ),
              FqaWidget(fqaName: "Can I create my own fundraising ?"),
              FqaWidget(
                fqaName: "How to top up balance on wecare ?",
              ),
              FqaWidget(
                fqaName: "How to withdraw on balance on wecare ?",
              ),
              FqaWidget(fqaName: "Is there a free tips to use this app"),
              FqaWidget(fqaName: "Is Wecare free to use?"),
              FqaWidget(fqaName: "How to make offer on Wecare ?")
            ],
          ),
        ));
  }
}
