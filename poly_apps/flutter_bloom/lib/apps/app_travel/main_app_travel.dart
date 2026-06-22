// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'router_app_travel/router_app_travel.dart';
import 'config_app_travel/provider_app_travel.dart';
import 'localization_app_travel/en_app_travel.dart';
import 'localization_app_travel/zh_app_travel.dart';
import 'services_app_travel/cache_service.dart';
import 'provider_app_travel/user_provider_app_travel.dart';
import 'provider_app_travel/home_provider_app_travel.dart';
import 'provider_app_travel/city_provider_app_travel.dart';
import 'provider_app_travel/search_provider_app_travel.dart';
import 'provider_app_travel/current_itinerary_provider.dart';
import 'provider_app_travel/traveler_provider_app_travel.dart';

void main() {
  runTravelApp();
}

Future<void> runTravelApp() async {
  WidgetsFlutterBinding.ensureInitialized();

  await prefsAppTravel.initSharedPreferences();

  final CacheService cacheService = CacheService();
  await cacheService.init();

  final UserProviderAppTravel userProvider = UserProviderAppTravel(
    cacheService: cacheService,
  );

  final HomeProviderAppTravel homeProvider = HomeProviderAppTravel();

  final CityProviderAppTravel cityProvider = CityProviderAppTravel(
    cacheService: cacheService,
  );

  final SearchProviderAppTravel searchProvider = SearchProviderAppTravel(
    cacheService: cacheService,
  );

  // Initialize current itinerary provider
  final CurrentItineraryProvider currentItineraryProvider = CurrentItineraryProvider();
  await currentItineraryProvider.initialize();

  // Initialize traveler provider
  final TravelerProviderAppTravel travelerProvider = TravelerProviderAppTravel();

  final router = RouterAppTravel.createRouter();

  runCommonApp(
    routerConfig: router,
    appPrefs: prefsAppTravel,
    enAppLocales: [enAppTravel],
    zhAppLocales: [zhAppTravel],
    appName: 'Travel App',
    appId: 'travel',
    additionalProviders: [
      ChangeNotifierProvider<UserProviderAppTravel>.value(value: userProvider),
      ChangeNotifierProvider<HomeProviderAppTravel>.value(value: homeProvider),
      ChangeNotifierProvider<CityProviderAppTravel>.value(value: cityProvider),
      ChangeNotifierProvider<SearchProviderAppTravel>.value(value: searchProvider),
      ChangeNotifierProvider<CurrentItineraryProvider>.value(value: currentItineraryProvider),
      ChangeNotifierProvider<TravelerProviderAppTravel>.value(value: travelerProvider),
    ],
  );
}
