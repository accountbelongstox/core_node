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
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../router_app_travel/routes_provider_app_travel.dart';

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Favorites'),
        elevation: 0,
      ),
      body: Consumer<UserProviderAppTravel>(
        builder: (context, userProvider, child) {
          final favorites = userProvider.user.favorites ?? [];

          if (favorites.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.favorite_border,
                    size: 80,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No favorites yet',
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Start exploring and save your favorite places',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[500],
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () {
                      context.push(TravelAppRoutesProvider.routeSearch);
                    },
                    icon: const Icon(Icons.search),
                    label: const Text('Explore Now'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 12,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }

          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.75,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
            ),
            itemCount: favorites.length,
            itemBuilder: (context, index) {
              final sightId = favorites[index];
              return _buildFavoriteCard(context, sightId, userProvider);
            },
          );
        },
      ),
    );
  }

  Widget _buildFavoriteCard(
    BuildContext context,
    String sightId,
    UserProviderAppTravel userProvider,
  ) {
    final mockSights = _getMockSights();
    final sight = mockSights.firstWhere(
      (s) => s['id'] == sightId,
      orElse: () => {
        'id': sightId,
        'title': 'Unknown Sight',
        'location': 'Unknown',
        'imageUrl': 'https://via.placeholder.com/300x200',
        'rating': 0.0,
        'price': 0.0,
      },
    );

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          context.push(TravelAppRoutesProvider.getSightDetailRoute(sightId));
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Image.network(
                  sight['imageUrl'] as String,
                  height: 120,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 120,
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
                      icon: const Icon(
                        Icons.favorite,
                        color: Colors.red,
                      ),
                      onPressed: () {
                        userProvider.removeFavorite(sightId);
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
                      sight['title'] as String,
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
                            sight['location'] as String,
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
                              sight['rating'].toString(),
                              style: const TextStyle(fontSize: 11),
                            ),
                          ],
                        ),
                        Text(
                          sight['price'] == 0.0
                              ? 'Free'
                              : '\$${(sight['price'] as double).toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: sight['price'] == 0.0 ? Colors.green : Colors.blue,
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

  List<Map<String, dynamic>> _getMockSights() {
    return [
      {
        'id': 'sight_1',
        'title': 'Great Wall',
        'imageUrl': 'https://via.placeholder.com/300x200?text=Great+Wall',
        'location': 'Beijing',
        'rating': 4.8,
        'price': 100.0,
      },
      {
        'id': 'sight_2',
        'title': 'West Lake',
        'imageUrl': 'https://via.placeholder.com/300x200?text=West+Lake',
        'location': 'Hangzhou',
        'rating': 4.7,
        'price': 0.0,
      },
      {
        'id': 'sight_3',
        'title': 'Terracotta Army',
        'imageUrl': 'https://via.placeholder.com/300x200?text=Terracotta+Army',
        'location': 'Xi\'an',
        'rating': 4.9,
        'price': 150.0,
      },
      {
        'id': 'sight_4',
        'title': 'Yellow Mountain',
        'imageUrl': 'https://via.placeholder.com/300x200?text=Yellow+Mountain',
        'location': 'Anhui',
        'rating': 4.8,
        'price': 200.0,
      },
      {
        'id': 'sight_5',
        'title': 'Bund',
        'imageUrl': 'https://via.placeholder.com/300x200?text=The+Bund',
        'location': 'Shanghai',
        'rating': 4.6,
        'price': 0.0,
      },
    ];
  }
}
