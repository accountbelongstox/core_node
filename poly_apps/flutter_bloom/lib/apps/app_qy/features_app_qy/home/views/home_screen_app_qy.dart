/// Home screen with study features and navigation
library home_screen_app_qy;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../provider_app_qy/user_provider_app_qy.dart';
import '../widgets/study_progress_card.dart';
import '../widgets/feature_grid.dart';
import '../widgets/study_stats_card.dart';

class HomeScreenAppQy extends StatefulWidget {
  const HomeScreenAppQy({super.key});

  @override
  State<HomeScreenAppQy> createState() => _HomeScreenAppQyState();
}

class _HomeScreenAppQyState extends State<HomeScreenAppQy> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const StudyTabView(),
    const CourseTabView(),
    const AIStudyTabView(),
    const DiscoverTabView(),
    const ProfileTabView(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: _buildBottomNavigation(),
    );
  }

  Widget _buildBottomNavigation() {
    return Container(
      decoration: ComponentStyles.bottomNavigationDecoration,
      child: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: AppTheme.primaryGreen,
        unselectedItemColor: Colors.grey,
        selectedFontSize: 12,
        unselectedFontSize: 12,
        elevation: 0,
        backgroundColor: Colors.transparent,
        items: [
          BottomNavigationBarItem(
            icon: const Icon(Icons.book),
            label: 'home.study'.tr,
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.school),
            label: 'home.course'.tr,
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.psychology),
            label: 'home.ai'.tr,
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.explore),
            label: 'home.discover'.tr,
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.person),
            label: 'home.profile'.tr,
          ),
        ],
      ),
    );
  }
}

/// Study tab - main learning screen
class StudyTabView extends StatelessWidget {
  const StudyTabView({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppTheme.primaryGreen.withOpacity(0.1),
            Colors.white,
          ],
        ),
      ),
      child: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 120,
              floating: false,
              pinned: true,
              backgroundColor: Colors.transparent,
              elevation: 0,
              flexibleSpace: FlexibleSpaceBar(
                title: Text(
                  'app.name'.tr,
                  style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                centerTitle: false,
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.search, color: AppTheme.textPrimary),
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.notifications_outlined, color: AppTheme.textPrimary),
                  onPressed: () {},
                ),
              ],
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const StudyProgressCard(),
                  const SizedBox(height: 16),
                  const StudyStatsCard(),
                  const SizedBox(height: 24),
                  _buildSectionTitle(context, 'home.moreFeatures'.tr),
                  const SizedBox(height: 12),
                  const FeatureGrid(),
                  const SizedBox(height: 80),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.bold,
        color: AppTheme.textPrimary,
      ),
    );
  }
}

/// Course tab - course list
class CourseTabView extends StatelessWidget {
  const CourseTabView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('home.course'.tr),
      ),
      body: const Center(
        child: Text('Course List - Coming Soon'),
      ),
    );
  }
}

/// AI Study tab
class AIStudyTabView extends StatelessWidget {
  const AIStudyTabView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('home.ai'.tr),
      ),
      body: const Center(
        child: Text('AI Study - Coming Soon'),
      ),
    );
  }
}

/// Discover tab
class DiscoverTabView extends StatelessWidget {
  const DiscoverTabView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('home.discover'.tr),
      ),
      body: const Center(
        child: Text('Discover - Coming Soon'),
      ),
    );
  }
}

/// Profile tab
class ProfileTabView extends StatelessWidget {
  const ProfileTabView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('home.profile'.tr),
      ),
      body: Consumer<UserProviderAppQy>(
        builder: (context, userProvider, child) {
          final user = userProvider.currentUser;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 40,
                        backgroundColor: AppTheme.primaryGreen,
                        child: Text(
                          user?.displayName?.substring(0, 1) ?? 'U',
                          style: const TextStyle(
                            fontSize: 32,
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        user?.displayName ?? 'User',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (user?.phone != null)
                        Text(
                          user!.phone!,
                          style: TextStyle(
                            color: Colors.grey[600],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.settings),
                title: Text('settings.title'.tr),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {},
              ),
              ListTile(
                leading: const Icon(Icons.logout),
                title: Text('auth.logout'.tr),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  await userProvider.signOut();
                  if (context.mounted) {
                    Navigator.of(context).pushReplacementNamed('/login');
                  }
                },
              ),
            ],
          );
        },
      ),
    );
  }
}