import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/fundraising/views/my_fudrasing_screen.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'activity_screen.dart';

class FundrasingScreenView extends StatelessWidget {
  const FundrasingScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
          appBar: AppBar(
              centerTitle: true,
              title: const Text(
                "My Fundraising",
                style: ThemeTextStyles.textMedium,
              ),
              bottom: TabBar(
                  indicatorColor: Theme.of(context).colorScheme.surfaceTint,
                  labelColor: Theme.of(context).colorScheme.surfaceTint,
                  tabs: const [
                    Tab(
                      child: Text(
                        "My Fundraising",
                        style: ThemeTextStyles.textMedium,
                      ),
                    ),
                    Tab(
                      child: Text(
                        "Activity",
                        style: ThemeTextStyles.textMedium,
                      ),
                    ),
                  ])),
          body: TabBarView(
              children: [MyFundraisingScreen(), const ActivityScreen()])),
    );
  }
}
