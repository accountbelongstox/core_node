import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/coming_widget.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/home/widget/urgent_fund_rising_widget.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

class BookMarkScreenView extends StatelessWidget {
  BookMarkScreenView({super.key});
  final List testlist = [0];
  @override
  Widget build(BuildContext context) {
    // Using common text styles directly

    return Scaffold(
      appBar: AppBar(
          forceMaterialTransparency: true,
          title: Text(
            "Bookmark",
            style: ThemeTextStyles.appNavigation,
          ),
          actions: const [
            Padding(
                padding: EdgeInsets.all(8.0),
                child: Icon(Icons.more_vert, color: ColorsAppQy.qySuccess))
          ]),
      body: Column(
        children: [
          const Padding(
              padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultSize),
              child: UrgentFundRisingWidget()),
          Expanded(
              child: testlist.isEmpty
                  ? Center(
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                          CircleAvatar(
                              radius: 50,
                              backgroundColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              child: Icon(Icons.bookmark,
                                  color: ColorsAppQy.qyTextOnPrimary)),
                          const SizedBox(
                            height: ThemeDimensions.sizeFifteen,
                          ),
                          Text("You have no Bookmark",
                              style: ThemeTextStyles.contentTitle.copyWith(
                                  color: ThemeColors.primaryBrand)),
                        ]))
                  : ListView.builder(
                      itemCount: 10,
                      itemBuilder: (_, index) {
                        return const ComingEndWidget();
                      }))
        ],
      ),
    );
  }
}
