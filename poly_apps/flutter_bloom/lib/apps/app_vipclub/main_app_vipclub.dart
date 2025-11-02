import 'package:flutter/material.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/en_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/zh_app_vipclub.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  runCommonApp(
    appName: 'VIP Club',
    routerConfig: createVipClubRouter(),
    enAppLocales: [enAppVipClub],
    zhAppLocales: [zhAppVipClub],
  );
}
