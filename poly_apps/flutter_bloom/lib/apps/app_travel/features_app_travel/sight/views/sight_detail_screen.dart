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
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/widgets/info_row_widget.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../models_app_travel/sight_model_app_travel.dart';

class SightDetailScreen extends StatefulWidget {
  final String? sightId;

  const SightDetailScreen({
    Key? key,
    this.sightId,
  }) : super(key: key);

  @override
  State<SightDetailScreen> createState() => _SightDetailScreenState();
}

class _SightDetailScreenState extends State<SightDetailScreen> {
  SightModelAppTravel? _sight;
  bool _isLoading;

  _SightDetailScreenState() : _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSightData();
  }

  Future<void> _loadSightData() async {
    setState(() {
      _isLoading = true;
    });

    await Future.delayed(const Duration(milliseconds: 500));

    final mockSights = _getMockSights();
    final sight = mockSights.firstWhere(
      (s) => s.id == widget.sightId,
      orElse: () => SightModelAppTravel(
        id: widget.sightId ?? 'unknown',
        title: 'Unknown Sight',
        imageUrl: 'https://via.placeholder.com/600x400',
        location: 'Unknown',
        rating: 0.0,
        price: 0.0,
        description: 'No description available',
        tags: [],
      ),
    );

    setState(() {
      _sight = sight;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _sight == null
              ? const Center(child: Text('Sight not found'))
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final userProvider = context.watch<UserProviderAppTravel>();
    final isFavorite = userProvider.isFavorite(_sight!.id);
    final isBookmarked = userProvider.isBookmarked(_sight!.id);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 300,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            title: Text(
              _sight!.title,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                shadows: [
                  Shadow(
                    offset: Offset(0, 1),
                    blurRadius: 3.0,
                    color: Color.fromARGB(255, 0, 0, 0),
                  ),
                ],
              ),
            ),
            background: Stack(
              fit: StackFit.expand,
              children: [
                Image.network(
                  _sight!.imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      color: Colors.grey[300],
                      child: const Icon(Icons.broken_image, size: 80),
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
                        Colors.black.withOpacity(0.7),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            IconButton(
              icon: Icon(
                isFavorite ? Icons.favorite : Icons.favorite_border,
                color: isFavorite ? Colors.red : Colors.white,
              ),
              onPressed: () {
                if (isFavorite) {
                  userProvider.removeFavorite(_sight!.id);
                } else {
                  userProvider.addFavorite(_sight!.id);
                }
              },
            ),
            IconButton(
              icon: Icon(
                isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                color: isBookmarked ? Colors.blue : Colors.white,
              ),
              onPressed: () {
                if (isBookmarked) {
                  userProvider.removeBookmark(_sight!.id);
                } else {
                  userProvider.addBookmark(_sight!.id);
                }
              },
            ),
          ],
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.location_on, size: 20, color: Colors.grey[600]),
                    const SizedBox(width: 4),
                    Text(
                      _sight!.location,
                      style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: _sight!.isFree ? Colors.green[50] : Colors.blue[50],
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _sight!.formattedPrice,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: _sight!.isFree ? Colors.green[700] : Colors.blue[700],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Icon(Icons.star, color: Colors.amber[600], size: 24),
                    const SizedBox(width: 4),
                    Text(
                      _sight!.rating.toString(),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '(Based on 1,234 reviews)',
                      style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _sight!.tags.map((tag) {
                    return Chip(
                      label: Text(tag),
                      backgroundColor: Colors.blue[50],
                      labelStyle: TextStyle(color: Colors.blue[700]),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 24),
                const Text(
                  'About',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _sight!.description,
                  style: TextStyle(
                    fontSize: 15,
                    color: Colors.grey[800],
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Information',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.grey.withOpacity(0.1),
                        spreadRadius: 1,
                        blurRadius: 5,
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      InfoRowWidget(
                        label: 'Opening Hours',
                        value: _sight!.openingHours ?? '9:00 AM - 6:00 PM',
                        showArrow: false,
                      ),
                      const Divider(height: 1),
                      InfoRowWidget(
                        label: 'Phone',
                        value: _sight!.phoneNumber ?? '+86 123-4567-8900',
                        showArrow: false,
                      ),
                      const Divider(height: 1),
                      InfoRowWidget(
                        label: 'Address',
                        value: _sight!.address ?? 'No address available',
                        showArrow: false,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                CustomButton(
                  buttonText: 'Book Now',
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Booking feature coming soon!'),
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                  icon: Icons.calendar_today,
                  height: 50,
                ),
                const SizedBox(height: 16),
                CustomButton(
                  buttonText: 'Get Directions',
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Opening maps...'),
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                  icon: Icons.directions,
                  transparent: true,
                  showBorder: true,
                  height: 50,
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }

  List<SightModelAppTravel> _getMockSights() {
    return [
      SightModelAppTravel(
        id: 'sight_1',
        title: 'Great Wall',
        imageUrl: 'https://via.placeholder.com/600x400?text=Great+Wall',
        location: 'Beijing',
        rating: 4.8,
        price: 100.0,
        description:
            'The Great Wall of China is a series of fortifications that were built across the historical northern borders of ancient Chinese states and Imperial China as protection against various nomadic groups. Several walls were built from as early as the 7th century BC.',
        tags: ['Historical', 'UNESCO', 'Adventure', 'Photography'],
        openingHours: '8:00 AM - 5:00 PM',
        phoneNumber: '+86 10-6912-2222',
        address: 'Badaling, Yanqing District, Beijing',
      ),
      SightModelAppTravel(
        id: 'sight_2',
        title: 'West Lake',
        imageUrl: 'https://via.placeholder.com/600x400?text=West+Lake',
        location: 'Hangzhou',
        rating: 4.7,
        price: 0.0,
        description:
            'West Lake is a freshwater lake in Hangzhou. It is divided into five sections by three causeways. The lake is one of the most famous tourist destinations in China and is known for its scenic beauty.',
        tags: ['Nature', 'Relaxation', 'Photography', 'UNESCO'],
        openingHours: '24 Hours',
        phoneNumber: '+86 571-8796-6666',
        address: 'Xihu District, Hangzhou, Zhejiang',
      ),
      SightModelAppTravel(
        id: 'sight_3',
        title: 'Terracotta Army',
        imageUrl: 'https://via.placeholder.com/600x400?text=Terracotta+Army',
        location: 'Xi\'an',
        rating: 4.9,
        price: 150.0,
        description:
            'The Terracotta Army is a collection of terracotta sculptures depicting the armies of Qin Shi Huang, the first emperor of China. It is a form of funerary art buried with the emperor in 210–209 BCE.',
        tags: ['Historical', 'UNESCO', 'Museum', 'Cultural'],
        openingHours: '8:30 AM - 6:00 PM',
        phoneNumber: '+86 29-8139-9001',
        address: 'Lintong District, Xi\'an, Shaanxi',
      ),
      SightModelAppTravel(
        id: 'sight_4',
        title: 'Yellow Mountain',
        imageUrl: 'https://via.placeholder.com/600x400?text=Yellow+Mountain',
        location: 'Anhui',
        rating: 4.8,
        price: 200.0,
        description:
            'The Yellow Mountains is a mountain range in southern Anhui Province. Known for its scenery, sunsets, granite peaks, pine trees, hot springs, winter snow, and views of the clouds from above.',
        tags: ['Nature', 'Adventure', 'Photography', 'UNESCO'],
        openingHours: '6:30 AM - 5:30 PM',
        phoneNumber: '+86 559-558-6060',
        address: 'Huangshan District, Huangshan, Anhui',
      ),
      SightModelAppTravel(
        id: 'sight_5',
        title: 'The Bund',
        imageUrl: 'https://via.placeholder.com/600x400?text=The+Bund',
        location: 'Shanghai',
        rating: 4.6,
        price: 0.0,
        description:
            'The Bund is a waterfront area and protected historical district in central Shanghai. The area centers on a section of Zhongshan Road within the former Shanghai International Settlement.',
        tags: ['City', 'Photography', 'Historical', 'Architecture'],
        openingHours: '24 Hours',
        phoneNumber: '+86 21-6329-8888',
        address: 'Zhongshan East 1st Road, Huangpu District, Shanghai',
      ),
    ];
  }
}
