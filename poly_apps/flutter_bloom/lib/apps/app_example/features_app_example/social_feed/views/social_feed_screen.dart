// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/social_feed/model/post_model.dart';
import 'package:qyflutter/apps/app_example/features_app_example/social_feed/widget/post_card.dart';
import 'package:qyflutter/apps/app_example/features_app_example/social_feed/widget/feed_header.dart';

class SocialFeedScreen extends StatefulWidget {
  const SocialFeedScreen({Key? key}) : super(key: key);

  @override
  State<SocialFeedScreen> createState() => _SocialFeedScreenState();
}

class _SocialFeedScreenState extends State<SocialFeedScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<Post> _posts = [
    // Sample data
    Post(
      id: '1',
      userId: 'user1',
      userName: 'Devon',
      userAvatar: 'https://picsum.photos/200',
      content:
          'Life is an adventure, and each day is a new chapter of that story. Let\'s make it unforgettable! 🌟',
      imageUrl: 'https://picsum.photos/400/600',
      createdAt: DateTime.now(),
      likes: 22,
      comments: 5,
      type: PostType.photo,
    ),
    Post(
      id: '2',
      userId: 'user2',
      userName: 'Marlene',
      userAvatar: 'https://picsum.photos/201',
      content: 'Share your smile and positive vibes with the world today! 😊',
      imageUrl: 'https://picsum.photos/400/500',
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
      likes: 15,
      comments: 3,
      type: PostType.photo,
    ),
    Post(
      id: '3',
      userId: 'user3',
      userName: 'Alex',
      userAvatar: 'https://picsum.photos/202',
      content: 'Beautiful sunset at the beach 🌅',
      imageUrl: 'https://picsum.photos/400/700',
      createdAt: DateTime.now().subtract(const Duration(hours: 3)),
      likes: 45,
      comments: 8,
      type: PostType.photo,
    ),
    Post(
      id: '4',
      userId: 'user4',
      userName: 'Sarah',
      userAvatar: 'https://picsum.photos/203',
      content: 'Morning coffee and good vibes ☕️',
      imageUrl: 'https://picsum.photos/400/550',
      createdAt: DateTime.now().subtract(const Duration(hours: 4)),
      likes: 30,
      comments: 6,
      type: PostType.photo,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _handleFilterTap() {
    // TODO: Implement filter functionality
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: FeedHeader(
        tabController: _tabController,
        onFilterTap: _handleFilterTap,
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // All Posts
          _buildMasonryGrid(_posts),
          // Photos
          _buildMasonryGrid(
              _posts.where((post) => post.type == PostType.photo).toList()),
          // Videos
          _buildMasonryGrid(
              _posts.where((post) => post.type == PostType.video).toList()),
          // Text Posts
          _buildMasonryGrid(
              _posts.where((post) => post.type == PostType.text).toList()),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Implement new post creation
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildMasonryGrid(List<Post> posts) {
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(8.0),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 8.0,
              crossAxisSpacing: 8.0,
              childAspectRatio: 0.7,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final post = posts[index];
                return Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (post.imageUrl != null)
                        AspectRatio(
                          aspectRatio: 1.0,
                          child: Image.network(
                            post.imageUrl!,
                            fit: BoxFit.cover,
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 12,
                                  backgroundImage:
                                      NetworkImage(post.userAvatar),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  post.userName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              post.content,
                              style: const TextStyle(fontSize: 12),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(Icons.favorite_border, size: 16),
                                const SizedBox(width: 4),
                                Text(
                                  '${post.likes}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                                const SizedBox(width: 16),
                                const Icon(Icons.comment_outlined, size: 16),
                                const SizedBox(width: 4),
                                Text(
                                  '${post.comments}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
              childCount: posts.length,
            ),
          ),
        ),
      ],
    );
  }
}
