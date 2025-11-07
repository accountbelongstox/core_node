import 'package:flutter/material.dart';
import '../domain/model/dictionary_model.dart';
import '../domain/service/dictionary_service.dart';
import '../data/mock_dictionaries.dart';
import '../widgets/dictionary_card.dart';
import '../widgets/waterfall_grid.dart';

/// Dictionary Recommendation Screen
/// Displays recommended dictionaries in a beautiful waterfall layout
class DictionaryRecommendScreen extends StatefulWidget {
  const DictionaryRecommendScreen({Key? key}) : super(key: key);

  @override
  State<DictionaryRecommendScreen> createState() => _DictionaryRecommendScreenState();
}

class _DictionaryRecommendScreenState extends State<DictionaryRecommendScreen> {
  final DictionaryService _service = DictionaryService();
  List<DictionaryModel> _dictionaries = [];
  List<DictionaryModel> _filteredDictionaries = [];
  bool _isLoading = true;
  String _selectedCategory = 'All';
  String _selectedDifficulty = 'All';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadDictionaries();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadDictionaries() async {
    setState(() => _isLoading = true);

    try {
      // Set mock data to service
      _service.setMockData(MockDictionaries.getMockDictionaries());

      // Fetch dictionaries
      final dictionaries = await _service.fetchRecommendedDictionaries();

      // Actually use the mock data since service returns empty
      final mockData = MockDictionaries.getMockDictionaries();

      setState(() {
        _dictionaries = mockData;
        _filteredDictionaries = mockData;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading dictionaries: $e')),
        );
      }
    }
  }

  void _applyFilters() {
    setState(() {
      _filteredDictionaries = _dictionaries.where((dict) {
        // Category filter
        final categoryMatch = _selectedCategory == 'All' || dict.category == _selectedCategory;

        // Difficulty filter
        final difficultyMatch = _selectedDifficulty == 'All' || dict.difficulty == _selectedDifficulty;

        // Search query
        final searchMatch = _searchQuery.isEmpty ||
            dict.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            dict.description.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            dict.tags.any((tag) => tag.toLowerCase().contains(_searchQuery.toLowerCase()));

        return categoryMatch && difficultyMatch && searchMatch;
      }).toList();
    });
  }

  Future<void> _handleToggleAdd(DictionaryModel dictionary) async {
    try {
      if (dictionary.isAdded) {
        await _service.removeDictionaryFromCollection(dictionary.id);
      } else {
        await _service.addDictionaryToCollection(dictionary.id);
      }

      // Update local state
      setState(() {
        final index = _dictionaries.indexWhere((d) => d.id == dictionary.id);
        if (index != -1) {
          _dictionaries[index] = _dictionaries[index].copyWith(isAdded: !dictionary.isAdded);
        }
        _applyFilters();
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(dictionary.isAdded ? 'Removed from library' : 'Added to library'),
            duration: const Duration(seconds: 1),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _handleLike(DictionaryModel dictionary) async {
    try {
      await _service.likeDictionary(dictionary.id);

      // Update local state
      setState(() {
        final index = _dictionaries.indexWhere((d) => d.id == dictionary.id);
        if (index != -1) {
          _dictionaries[index] = _dictionaries[index].copyWith(
            likeCount: _dictionaries[index].likeCount + 1,
          );
        }
        _applyFilters();
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('❤️ Liked!'),
            duration: Duration(seconds: 1),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  void _handleViewDetails(DictionaryModel dictionary) {
    // TODO: Navigate to dictionary details screen
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(dictionary.title),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  dictionary.imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 150,
                      color: Colors.grey[300],
                      child: const Icon(Icons.image, size: 48),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              Text(
                dictionary.description,
                style: const TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.book_outlined, 'Words', '${dictionary.wordCount}'),
              _buildDetailRow(Icons.favorite, 'Likes', '${dictionary.likeCount}'),
              _buildDetailRow(Icons.category, 'Category', dictionary.category),
              _buildDetailRow(Icons.star, 'Difficulty', dictionary.difficulty),
              _buildDetailRow(Icons.person, 'Author', dictionary.author),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: dictionary.tags.map((tag) {
                  return Chip(
                    label: Text('#$tag', style: const TextStyle(fontSize: 12)),
                    backgroundColor: Colors.blue[50],
                    side: BorderSide(color: Colors.blue[200]!),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _handleToggleAdd(dictionary);
            },
            child: Text(dictionary.isAdded ? 'Remove' : 'Add to Library'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.blue[700]),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recommended Dictionaries'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDictionaries,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          _buildSearchBar(),

          // Filters
          _buildFilters(),

          // Dictionary Count
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Text(
                  '${_filteredDictionaries.length} dictionaries',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          // Waterfall Grid
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredDictionaries.isEmpty
                    ? _buildEmptyState()
                    : ResponsiveWaterfallGrid(
                        padding: const EdgeInsets.all(16),
                        mainAxisSpacing: 16,
                        crossAxisSpacing: 16,
                        children: _filteredDictionaries.map((dictionary) {
                          return DictionaryCard(
                            dictionary: dictionary,
                            onTap: () => _handleViewDetails(dictionary),
                            onLike: () => _handleLike(dictionary),
                            onToggleAdd: () => _handleToggleAdd(dictionary),
                          );
                        }).toList(),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Theme.of(context).primaryColor.withOpacity(0.05),
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: 'Search dictionaries...',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    _searchController.clear();
                    setState(() {
                      _searchQuery = '';
                      _applyFilters();
                    });
                  },
                )
              : null,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
        onChanged: (value) {
          setState(() {
            _searchQuery = value;
            _applyFilters();
          });
        },
      ),
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: _buildFilterChip(
              'Category',
              _selectedCategory,
              ['All', ...MockDictionaries.getAllCategories()],
              (value) {
                setState(() {
                  _selectedCategory = value;
                  _applyFilters();
                });
              },
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildFilterChip(
              'Difficulty',
              _selectedDifficulty,
              ['All', 'beginner', 'intermediate', 'advanced'],
              (value) {
                setState(() {
                  _selectedDifficulty = value;
                  _applyFilters();
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, List<String> options, Function(String) onChanged) {
    return InkWell(
      onTap: () {
        showModalBottomSheet(
          context: context,
          builder: (context) => Container(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Select $label',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                ...options.map((option) => ListTile(
                      title: Text(option),
                      trailing: value == option ? const Icon(Icons.check, color: Colors.blue) : null,
                      onTap: () {
                        onChanged(option);
                        Navigator.pop(context);
                      },
                    )),
              ],
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.blue[50],
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.blue[200]!),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.blue[900],
                  fontWeight: FontWeight.w600,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.arrow_drop_down, color: Colors.blue[700], size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'No dictionaries found',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Try adjusting your filters',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }
}
