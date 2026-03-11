import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../constants_app_travel/cities_app_travel.dart';

const Map<int, String> _monthSubtitleMap = {
  1: '人少景美',
  2: '春节出游',
  3: '春暖花开',
  4: '赏樱花',
  5: '五一小长假',
  6: '端午出游',
  7: '盛夏避暑',
  8: '暑假亲子',
  9: '秋高气爽',
  10: '国庆长假',
  11: '天凉好个秋',
  12: '玩雪泡温泉',
};

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  int _selectedMonthIndex = 0;

  late final List<Map<String, String>> _monthTabs;
  late final Map<String, dynamic> _featuredDestination;

  final List<Map<String, dynamic>> _destinations = [
    {
      'image': 'assets/apps/app_travel/images/destination_sanya.png',
      'title': '三亚',
      'subtitle': '全年人流最少时',
    },
    {
      'image': 'assets/apps/app_travel/images/destination_hongcun.png',
      'title': '宏村',
      'subtitle': '秋色正浓皖南景致',
    },
    {
      'image': 'assets/apps/app_travel/images/destination_changbai.png',
      'title': '长白山',
      'subtitle': '新雪季，开板滑雪去',
    },
    {
      'image': 'assets/apps/app_travel/images/destination_tengchong.png',
      'title': '腾冲',
      'subtitle': '赏银杏，泡温泉',
    },
  ];

  @override
  void initState() {
    super.initState();
    _initFromCurrentDate();
  }

  void _initFromCurrentDate() {
    final now = DateTime.now();
    final currentMonth = now.month;
    _monthTabs = List.generate(4, (i) {
      final m = ((currentMonth - 1 + i) % 12) + 1;
      return {
        'label': '$m月',
        'subtitle': _monthSubtitleMap[m] ?? '',
      };
    });
    _featuredDestination = {
      'image': 'assets/apps/app_travel/images/inspiration_november.png',
      'title': '${currentMonth}月去哪儿玩',
      'recommend': 40319,
    };
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = context.watch<UserProviderAppTravel>();
    final currentCity = userProvider.user.currentCity ?? CitiesAppTravel.defaultCity;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildHeaderWithSearch(),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildTravelInspiration(),
                _buildBroadcastNotice(),
                _buildPromotion(),
                const SizedBox(height: 80.0),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          debugPrint('Create content tapped');
        },
        backgroundColor: const Color(0xFF00D0D8),
        child: const Icon(
          Icons.add,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildHeaderWithSearch() {
    return Consumer<UserProviderAppTravel>(
      builder: (context, userProvider, child) {
        final currentCity = userProvider.user.currentCity ?? CitiesAppTravel.defaultCity;

        return SliverAppBar(
          expandedHeight: 280.0,
          floating: false,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  'assets/apps/app_travel/images/explore_header_bg.png',
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0xFFFF9A56), Color(0xFFFF7A3D)],
                        ),
                      ),
                    );
                  },
                ),
                Positioned(
                  left: 16.0,
                  top: 60.0,
                  child: Row(
                    children: [
                      const Text(
                        '看世界',
                        style: TextStyle(
                          fontSize: 24.0,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 12.0),
                      Text(
                        currentCity,
                        style: const TextStyle(
                          fontSize: 16.0,
                          color: Colors.white,
                        ),
                      ),
                  const Icon(
                    Icons.keyboard_arrow_down,
                    color: Colors.white,
                    size: 20.0,
                  ),
                ],
              ),
            ),
            Positioned(
              right: 16.0,
              top: 60.0,
              child: Row(
                children: [
                  Container(
                    width: 36.0,
                    height: 36.0,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.notifications_outlined,
                      size: 20.0,
                      color: Colors.black54,
                    ),
                  ),
                  const SizedBox(width: 8.0),
                  Container(
                    width: 36.0,
                    height: 36.0,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.person_outline,
                      size: 20.0,
                      color: Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 16.0,
              right: 16.0,
              bottom: 16.0,
              child: Container(
                height: 48.0,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24.0),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 8.0,
                      offset: const Offset(0, 2.0),
                    ),
                  ],
                ),
                child: Row(
                  children: const [
                    SizedBox(width: 16.0),
                    Icon(
                      Icons.search,
                      size: 22.0,
                      color: Colors.grey,
                    ),
                    SizedBox(width: 12.0),
                    Text(
                      '想去哪儿，搜一搜',
                      style: TextStyle(
                        fontSize: 15.0,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
        );
      },
    );
  }

  Widget _buildTravelInspiration() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.0),
            child: Text(
              '出行灵感',
              style: TextStyle(
                fontSize: 18.0,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
          ),
          const SizedBox(height: 12.0),
          SizedBox(
            height: 80.0,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              itemCount: _monthTabs.length,
              itemBuilder: (context, index) {
                final tab = _monthTabs[index];
                final isSelected = _selectedMonthIndex == index;
                return GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedMonthIndex = index;
                    });
                  },
                  child: Container(
                    width: 90.0,
                    margin: const EdgeInsets.only(right: 12.0),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8.0),
                      color: isSelected
                          ? const Color(0xFFFF9A56)
                          : const Color(0xFFF5F5F5),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          tab['label']!,
                          style: TextStyle(
                            fontSize: 16.0,
                            fontWeight: FontWeight.bold,
                            color: isSelected ? Colors.white : Colors.black87,
                          ),
                        ),
                        if (tab['subtitle']!.isNotEmpty) ...[
                          const SizedBox(height: 4.0),
                          Text(
                            tab['subtitle']!,
                            style: TextStyle(
                              fontSize: 11.0,
                              color: isSelected ? Colors.white : Colors.black54,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16.0),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: Container(
                    height: 340.0,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8.0),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.asset(
                            _featuredDestination['image'],
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                color: const Color(0xFFFFC107),
                              );
                            },
                          ),
                          Positioned(
                            bottom: 16.0,
                            left: 16.0,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12.0,
                                    vertical: 6.0,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF00D0D8),
                                    borderRadius: BorderRadius.circular(4.0),
                                  ),
                                  child: Text(
                                    _featuredDestination['title'],
                                    style: const TextStyle(
                                      fontSize: 15.0,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8.0),
                                Text(
                                  '${_featuredDestination['recommend']}人推荐',
                                  style: const TextStyle(
                                    fontSize: 13.0,
                                    color: Colors.white,
                                    shadows: [
                                      Shadow(
                                        color: Colors.black38,
                                        blurRadius: 4.0,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8.0),
                Expanded(
                  flex: 2,
                  child: Column(
                    children: _destinations.map((dest) {
                      return Container(
                        height: 82.0,
                        margin: const EdgeInsets.only(bottom: 8.0),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8.0),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8.0),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              Image.asset(
                                dest['image'],
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Container(
                                    color: Colors.grey[300],
                                  );
                                },
                              ),
                              Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.transparent,
                                      Colors.black.withOpacity(0.6),
                                    ],
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: 8.0,
                                left: 8.0,
                                right: 8.0,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      dest['title'],
                                      style: const TextStyle(
                                        fontSize: 14.0,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                    const SizedBox(height: 2.0),
                                    Text(
                                      dest['subtitle'],
                                      style: const TextStyle(
                                        fontSize: 11.0,
                                        color: Colors.white70,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12.0),
          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(3, (index) {
                return Container(
                  width: index == 0 ? 16.0 : 8.0,
                  height: 8.0,
                  margin: const EdgeInsets.symmetric(horizontal: 3.0),
                  decoration: BoxDecoration(
                    color: index == 0 ? const Color(0xFF00D0D8) : const Color(0xFFD9D9D9),
                    borderRadius: BorderRadius.circular(4.0),
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBroadcastNotice() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8F0),
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Row(
        children: const [
          Icon(
            Icons.volume_up,
            size: 20.0,
            color: Color(0xFFFF6B35),
          ),
          SizedBox(width: 8.0),
          Text(
            '广播',
            style: TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFF6B35),
            ),
          ),
          SizedBox(width: 8.0),
          Text(
            '【重要通知】',
            style: TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          Expanded(
            child: Text(
              '#夏日玩水/避暑好去处#',
              style: TextStyle(
                fontSize: 13.0,
                color: Colors.black54,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Icon(
            Icons.chevron_right,
            size: 20.0,
            color: Colors.black26,
          ),
        ],
      ),
    );
  }

  Widget _buildPromotion() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      height: 160.0,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8.0),
        child: Image.asset(
          'assets/apps/app_travel/images/promo_winter_banner.png',
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF4DA0E8), Color(0xFF87CEEB)],
                ),
              ),
              child: const Center(
                child: Text(
                  '冬季一年赏雪季',
                  style: TextStyle(
                    fontSize: 24.0,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
