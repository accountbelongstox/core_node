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
import 'package:qyflutter/common/widgets/custom_button.dart';
import '../../../provider_app_travel/search_provider_app_travel.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../router_app_travel/routes_provider_app_travel.dart';
import '../../../models_app_travel/sight_model_app_travel.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({Key? key}) : super(key: key);

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> with AutomaticKeepAliveClientMixin {
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory;

  _ExploreScreenState() : _selectedCategory = 'All';

  @override
  bool get wantKeepAlive => true;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Explore',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    GestureDetector(
                      onTap: () {
                        context.push(TravelAppRoutesProvider.routeSearch);
                      },
                      child: Container(
                        height: 50,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(25),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.grey.withOpacity(0.2),
                              spreadRadius: 1,
                              blurRadius: 5,
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            const SizedBox(width: 16),
                            Icon(Icons.search, color: Colors.grey[600]),
                            const SizedBox(width: 12),
                            Text(
                              'Search destinations...',
                              style: TextStyle(
                                fontSize: 16,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    _buildCategoryFilters(),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: _buildExploreContent(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryFilters() {
    final categories = ['All', 'Nature', 'Historical', 'City', 'Adventure', 'Beach'];

    return SizedBox(
      height: 40,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        itemBuilder: (context, index) {
          final category = categories[index];
          final isSelected = _selectedCategory == category;

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(category),
              selected: isSelected,
              onSelected: (selected) {
                setState(() {
                  _selectedCategory = category;
                });
              },
              backgroundColor: Colors.white,
              selectedColor: Colors.blue[100],
              labelStyle: TextStyle(
                color: isSelected ? Colors.blue[700] : Colors.grey[800],
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildExploreContent() {
    final allSights = _getFilteredSights();

    return SliverGrid(
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.7,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final sight = allSights[index];
          return _buildSightCard(sight);
        },
        childCount: allSights.length,
      ),
    );
  }

  Widget _buildSightCard(SightModelAppTravel sight) {
    final userProvider = context.watch<UserProviderAppTravel>();
    final isFavorite = userProvider.isFavorite(sight.id);

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: () {
          context.push(TravelAppRoutesProvider.getSightDetailRoute(sight.id));
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Image.network(
                  sight.imageUrl,
                  height: 140,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 140,
                      color: Colors.grey[300],
                      child: const Icon(Icons.broken_image, size: 48),
                    );
                  },
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: Colors.white,
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      iconSize: 18,
                      icon: Icon(
                        isFavorite ? Icons.favorite : Icons.favorite_border,
                        color: isFavorite ? Colors.red : Colors.grey,
                      ),
                      onPressed: () {
                        if (isFavorite) {
                          userProvider.removeFavorite(sight.id);
                        } else {
                          userProvider.addFavorite(sight.id);
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sight.title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.location_on, size: 12, color: Colors.grey[600]),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            sight.location,
                            style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.star, size: 12, color: Colors.amber),
                            const SizedBox(width: 2),
                            Text(
                              sight.rating.toString(),
                              style: const TextStyle(fontSize: 11),
                            ),
                          ],
                        ),
                        Text(
                          sight.formattedPrice,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: sight.isFree ? Colors.green : Colors.blue,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<SightModelAppTravel> _getFilteredSights() {
    final allSights = _getAllSights();

    if (_selectedCategory == 'All') {
      return allSights;
    }

    return allSights.where((sight) {
      return sight.tags.any((tag) => tag.toLowerCase() == _selectedCategory.toLowerCase());
    }).toList();
  }

  List<SightModelAppTravel> _getAllSights() {
    return [
      SightModelAppTravel(
        id: 'sight_1',
        title: 'Great Wall',
        imageUrl: 'https://via.placeholder.com/300x200?text=Great+Wall',
        location: 'Beijing',
        rating: 4.8,
        price: 100.0,
        description: 'Ancient Chinese fortification',
        tags: ['Historical', 'UNESCO', 'Adventure'],
      ),
      SightModelAppTravel(
        id: 'sight_2',
        title: 'West Lake',
        imageUrl: 'https://via.placeholder.com/300x200?text=West+Lake',
        location: 'Hangzhou',
        rating: 4.7,
        price: 0.0,
        description: 'Beautiful scenic lake',
        tags: ['Nature', 'Relaxation'],
      ),
      SightModelAppTravel(
        id: 'sight_3',
        title: 'Terracotta Army',
        imageUrl: 'https://via.placeholder.com/300x200?text=Terracotta+Army',
        location: 'Xi\'an',
        rating: 4.9,
        price: 150.0,
        description: 'Ancient archaeological site',
        tags: ['Historical', 'UNESCO', 'Museum'],
      ),
      SightModelAppTravel(
        id: 'sight_4',
        title: 'Yellow Mountain',
        imageUrl: 'https://via.placeholder.com/300x200?text=Yellow+Mountain',
        location: 'Anhui',
        rating: 4.8,
        price: 200.0,
        description: 'Stunning mountain scenery',
        tags: ['Nature', 'Adventure'],
      ),
      SightModelAppTravel(
        id: 'sight_5',
        title: 'The Bund',
        imageUrl: 'https://via.placeholder.com/300x200?text=The+Bund',
        location: 'Shanghai',
        rating: 4.6,
        price: 0.0,
        description: 'Historic waterfront area',
        tags: ['City', 'Historical'],
      ),
      SightModelAppTravel(
        id: 'sight_6',
        title: 'Zhangjiajie',
        imageUrl: 'https://via.placeholder.com/300x200?text=Zhangjiajie',
        location: 'Hunan',
        rating: 4.9,
        price: 180.0,
        description: 'Avatar mountains inspiration',
        tags: ['Nature', 'Adventure', 'UNESCO'],
      ),
      SightModelAppTravel(
        id: 'sight_7',
        title: 'Sanya Beach',
        imageUrl: 'https://via.placeholder.com/300x200?text=Sanya+Beach',
        location: 'Hainan',
        rating: 4.5,
        price: 0.0,
        description: 'Tropical paradise beach',
        tags: ['Beach', 'Nature', 'Relaxation'],
      ),
      SightModelAppTravel(
        id: 'sight_8',
        title: 'Forbidden City',
        imageUrl: 'https://via.placeholder.com/300x200?text=Forbidden+City',
        location: 'Beijing',
        rating: 4.8,
        price: 120.0,
        description: 'Imperial palace complex',
        tags: ['Historical', 'UNESCO', 'City'],
      ),
    ];
  }
}
