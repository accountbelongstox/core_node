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
import 'package:go_router/go_router.dart';
import '../../../provider_app_travel/home_provider_app_travel.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../router_app_travel/routes_provider_app_travel.dart';
import '../../../config_app_travel/constants_app_travel.dart';
import '../widgets/home_swiper.dart';
import '../widgets/home_header.dart';
import '../widgets/home_local_nav.dart';
import '../widgets/home_grid_nav_section.dart';
import '../widgets/home_subnav.dart';
import '../widgets/home_welcome.dart';
import '../widgets/home_popular.dart';
import '../widgets/home_recommend.dart';
import '../widgets/home_content_mix.dart';
import '../widgets/home_local_hot.dart';
import '../widgets/home_waterfall.dart';
import '../widgets/home_location_prompt.dart';

class HomeScreen extends StatefulWidget {
  final bool isInScaffold;

  const HomeScreen({
    super.key,
    this.isInScaffold = false,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _scrollController = ScrollController();
  double _scrollTop = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final homeProvider = context.read<HomeProviderAppTravel>();
      if (!homeProvider.hasData) {
        homeProvider.loadHomeData();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    setState(() {
      _scrollTop = _scrollController.offset;
    });
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = context.watch<UserProviderAppTravel>();
    final homeProvider = context.watch<HomeProviderAppTravel>();

    final content = Stack(
      children: [
        RefreshIndicator(
          onRefresh: () => homeProvider.refresh(),
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
          if (homeProvider.isLoading && !homeProvider.hasData)
            const SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(),
              ),
            )
          else if (homeProvider.hasError)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      size: 60,
                      color: Colors.red,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Error: ${homeProvider.errorMessage}',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => homeProvider.loadHomeData(forceRefresh: true),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          else if (homeProvider.hasData)
            SliverList(
              delegate: SliverChildListDelegate([
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    HomeSwiper(
                      swiperItems: homeProvider.homeData!.data.swipeImages,
                    ),
                    Positioned(
                      top: 30,
                      left: 0,
                      right: 0,
                      child: HomeHeader(
                        scrollTop: _scrollTop,
                        currentCity: userProvider.user.currentCity ?? TravelAppConstants.defaultCityName,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 46),
                HomeLocalNav(
                  localNavs: homeProvider.homeData!.data.localNavs,
                ),
                Column(
                  children: [
                    HomeGridNavSection(
                      gridNavs: homeProvider.homeData!.data.gridNavs,
                    ),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      child: HomeRecommend(
                        recommend: homeProvider.homeData!.data.recommend,
                      ),
                    ),
                    const SizedBox(height: 12),
                    HomeSubnav(
                      subnavs: homeProvider.homeData!.data.subnavs,
                    ),
                    const SizedBox(height: 12),
                    HomeWelcome(
                      cityName: userProvider.user.currentCity ?? TravelAppConstants.defaultCityName,
                      temperature: TravelAppConstants.defaultTemperature,
                    ),
                    const SizedBox(height: 12),
                    const HomeContentMix(),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      child: HomePopular(
                        popularItems: homeProvider.homeData!.data.popularList,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      child: HomeLocalHot(
                        localHot: homeProvider.homeData!.data.localHot,
                        hideTitle: false,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (homeProvider.homeData!.data.sights != null &&
                        homeProvider.homeData!.data.sights!.isNotEmpty)
                      HomeWaterfall(
                        sights: homeProvider.homeData!.data.sights!,
                      ),
                  ],
                ),
                SizedBox(height: widget.isInScaffold ? 10 : 40),
              ]),
            ),
          ],
        ),
      ),
    ],
  );

    if (widget.isInScaffold) {
      return content;
    }

    return Scaffold(
      body: content,
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: 0,
        selectedItemColor: Colors.blue,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.explore),
            label: 'Explore',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.favorite_border),
            label: 'Favorites',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
        onTap: (index) {
          switch (index) {
            case 1:
              context.push(TravelAppRoutesProvider.routeSearch);
              break;
            case 2:
              context.push(TravelAppRoutesProvider.routeFavorites);
              break;
            case 3:
              context.push(TravelAppRoutesProvider.routeProfile);
              break;
          }
        },
      ),
    );
  }
}
