import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/home/controllers/home_controller.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/home/widgets/facility_card.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/home/widgets/vip_status_card.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/localization_keys_app_vipclub.dart';

class VipClubHomeScreen extends StatefulWidget {
  const VipClubHomeScreen({super.key});

  @override
  State<VipClubHomeScreen> createState() => _VipClubHomeScreenState();
}

class _VipClubHomeScreenState extends State<VipClubHomeScreen> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VipClubHomeController>().initialize();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _buildBody(),
      bottomNavigationBar: _buildBottomNavBar(),
    );
  }

  Widget _buildBody() {
    return Consumer<VipClubHomeController>(
      builder: (context, controller, child) {
        if (controller.isLoading) {
          return const Center(
            child: CircularProgressIndicator(),
          );
        }

        if (controller.errorMessage != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  controller.errorMessage!,
                  style: ThemeTextStyles.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: ThemeDimensions.mediumPadding),
                ElevatedButton(
                  onPressed: () => controller.refresh(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => controller.refresh(),
          child: CustomScrollView(
            slivers: [
              _buildAppBar(controller),
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (controller.isLoggedIn && controller.isVipMember)
                      _buildVipSection(controller),
                    _buildQuickActions(context),
                    _buildFeaturedFacilities(controller),
                    SizedBox(height: ThemeDimensions.largePadding),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAppBar(VipClubHomeController controller) {
    return SliverAppBar(
      expandedHeight: 120,
      floating: false,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          controller.getGreeting(),
          style: ThemeTextStyles.headingMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        background: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                ThemeColors.primaryBlue,
                ThemeColors.primaryBlue.withOpacity(0.8),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Padding(
            padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  controller.getUserDisplayName(),
                  style: ThemeTextStyles.headingLarge.copyWith(
                    color: ThemeColors.neutralWhite,
                  ),
                ),
                Text(
                  controller.getMembershipBadge(),
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ThemeColors.neutralWhite.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        if (controller.isLoggedIn)
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
        IconButton(
          icon: const Icon(Icons.settings_outlined),
          onPressed: () => context.push(VipClubRoutes.settings),
        ),
      ],
    );
  }

  Widget _buildVipSection(VipClubHomeController controller) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: VipStatusCard(
        memberType: controller.currentUser!.memberType,
        points: controller.getUserPoints(),
        discountRate: controller.getUserDiscount(),
        onTap: () => context.push(VipClubRoutes.vipZone),
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.smallPadding,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Quick Access',
            style: ThemeTextStyles.headingMedium,
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildQuickActionCard(
                context,
                icon: Icons.my_location,
                label: 'Shooting',
                color: ThemeColors.accentOrange,
                onTap: () => context.push(VipClubRoutes.shooting),
              ),
              _buildQuickActionCard(
                context,
                icon: Icons.golf_course,
                label: 'Golf',
                color: ThemeColors.accentGreen,
                onTap: () => context.push(VipClubRoutes.golf),
              ),
              _buildQuickActionCard(
                context,
                icon: Icons.hotel,
                label: 'Hotel',
                color: ThemeColors.primaryBlue,
                onTap: () => context.push(VipClubRoutes.hotel),
              ),
              _buildQuickActionCard(
                context,
                icon: Icons.book_online,
                label: 'Bookings',
                color: ThemeColors.accentPurple,
                onTap: () => context.push(VipClubRoutes.bookings),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionCard(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.tinyPadding,
          ),
          padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
            border: Border.all(
              color: color.withOpacity(0.3),
              width: 1,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: color,
                size: 32,
              ),
              SizedBox(height: ThemeDimensions.tinyPadding),
              Text(
                label,
                style: ThemeTextStyles.captionMedium.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeaturedFacilities(VipClubHomeController controller) {
    if (controller.featuredFacilities.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.mediumPadding,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Featured Facilities',
                style: ThemeTextStyles.headingMedium,
              ),
              TextButton(
                onPressed: () => context.push(VipClubRoutes.facilities),
                child: Text('View All'),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          SizedBox(
            height: 220,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: controller.featuredFacilities.length,
              itemBuilder: (context, index) {
                final facility = controller.featuredFacilities[index];
                return FacilityCard(
                  facility: facility,
                  onTap: () {
                    String route;
                    switch (facility.type) {
                      case 'shooting':
                        route = VipClubRoutes.shootingDetails
                            .replaceAll(':id', facility.id);
                        break;
                      case 'golf':
                        route = VipClubRoutes.golfDetails
                            .replaceAll(':id', facility.id);
                        break;
                      case 'hotel':
                        route = VipClubRoutes.hotelDetails
                            .replaceAll(':id', facility.id);
                        break;
                      default:
                        return;
                    }
                    context.push(route);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNavBar() {
    return BottomNavigationBar(
      currentIndex: _selectedIndex,
      type: BottomNavigationBarType.fixed,
      selectedItemColor: ThemeColors.primaryBlue,
      unselectedItemColor: ThemeColors.neutralGrey,
      onTap: (index) {
        setState(() {
          _selectedIndex = index;
        });

        switch (index) {
          case 0:
            break;
          case 1:
            context.push(VipClubRoutes.facilities);
            break;
          case 2:
            context.push(VipClubRoutes.bookings);
            break;
          case 3:
            context.push(VipClubRoutes.profile);
            break;
        }
      },
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.home_outlined),
          activeIcon: Icon(Icons.home),
          label: 'Home',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.location_on_outlined),
          activeIcon: Icon(Icons.location_on),
          label: 'Facilities',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.book_outlined),
          activeIcon: Icon(Icons.book),
          label: 'Bookings',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person_outline),
          activeIcon: Icon(Icons.person),
          label: 'Profile',
        ),
      ],
    );
  }
}
