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
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../router_app_travel/routes_provider_app_travel.dart';

class BookmarksScreen extends StatelessWidget {
  const BookmarksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Bookmarks'),
        elevation: 0,
        actions: [
          Consumer<UserProviderAppTravel>(
            builder: (context, userProvider, child) {
              final bookmarks = userProvider.user.bookmarks ?? [];
              if (bookmarks.isEmpty) return const SizedBox.shrink();

              return PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'clear_all') {
                    _showClearAllDialog(context, userProvider);
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'clear_all',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline, size: 20),
                        SizedBox(width: 8),
                        Text('Clear All'),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
      body: Consumer<UserProviderAppTravel>(
        builder: (context, userProvider, child) {
          final bookmarks = userProvider.user.bookmarks ?? [];

          if (bookmarks.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.bookmark_border,
                    size: 80,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No bookmarks yet',
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Save places you want to visit later',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[500],
                    ),
                  ),
                  const SizedBox(height: 24),
                  CustomButton(
                    buttonText: 'Explore Now',
                    onPressed: () {
                      context.push(TravelAppRoutesProvider.routeSearch);
                    },
                    icon: Icons.search,
                    width: 200,
                    height: 48,
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: bookmarks.length,
            itemBuilder: (context, index) {
              final sightId = bookmarks[index];
              return _buildBookmarkCard(context, sightId, userProvider);
            },
          );
        },
      ),
    );
  }

  void _showClearAllDialog(BuildContext context, UserProviderAppTravel userProvider) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear All Bookmarks'),
        content: const Text('Are you sure you want to remove all bookmarks?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final bookmarks = List<String>.from(userProvider.user.bookmarks ?? []);
              for (final bookmark in bookmarks) {
                userProvider.removeBookmark(bookmark);
              }
              Navigator.of(context).pop();
            },
            child: const Text('Clear All'),
          ),
        ],
      ),
    );
  }

  Widget _buildBookmarkCard(
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
        'imageUrl': 'https://via.placeholder.com/400x200',
        'rating': 0.0,
        'price': 0.0,
      },
    );

    final isFavorite = userProvider.isFavorite(sightId);

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: () {
          context.push(TravelAppRoutesProvider.getSightDetailRoute(sightId));
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  sight['imageUrl'] as String,
                  width: 100,
                  height: 100,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: 100,
                      height: 100,
                      color: Colors.grey[300],
                      child: const Icon(Icons.broken_image, size: 40),
                    );
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sight['title'] as String,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.location_on, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            sight['location'] as String,
                            style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.star, size: 14, color: Colors.amber),
                            const SizedBox(width: 2),
                            Text(
                              sight['rating'].toString(),
                              style: const TextStyle(fontSize: 13),
                            ),
                          ],
                        ),
                        const SizedBox(width: 12),
                        Text(
                          sight['price'] == 0.0
                              ? 'Free'
                              : '\$${(sight['price'] as double).toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: sight['price'] == 0.0 ? Colors.green : Colors.blue,
                          ),
                        ),
                        const Spacer(),
                        IconButton(
                          icon: Icon(
                            isFavorite ? Icons.favorite : Icons.favorite_border,
                            color: isFavorite ? Colors.red : Colors.grey,
                            size: 20,
                          ),
                          onPressed: () {
                            if (isFavorite) {
                              userProvider.removeFavorite(sightId);
                            } else {
                              userProvider.addFavorite(sightId);
                            }
                          },
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.bookmark,
                            color: Colors.blue,
                            size: 20,
                          ),
                          onPressed: () {
                            userProvider.removeBookmark(sightId);
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Map<String, dynamic>> _getMockSights() {
    return [
      {
        'id': 'sight_1',
        'title': 'Great Wall',
        'imageUrl': 'https://via.placeholder.com/400x200?text=Great+Wall',
        'location': 'Beijing',
        'rating': 4.8,
        'price': 100.0,
      },
      {
        'id': 'sight_2',
        'title': 'West Lake',
        'imageUrl': 'https://via.placeholder.com/400x200?text=West+Lake',
        'location': 'Hangzhou',
        'rating': 4.7,
        'price': 0.0,
      },
      {
        'id': 'sight_3',
        'title': 'Terracotta Army',
        'imageUrl': 'https://via.placeholder.com/400x200?text=Terracotta+Army',
        'location': 'Xi\'an',
        'rating': 4.9,
        'price': 150.0,
      },
      {
        'id': 'sight_4',
        'title': 'Yellow Mountain',
        'imageUrl': 'https://via.placeholder.com/400x200?text=Yellow+Mountain',
        'location': 'Anhui',
        'rating': 4.8,
        'price': 200.0,
      },
      {
        'id': 'sight_5',
        'title': 'The Bund',
        'imageUrl': 'https://via.placeholder.com/400x200?text=The+Bund',
        'location': 'Shanghai',
        'rating': 4.6,
        'price': 0.0,
      },
    ];
  }
}
