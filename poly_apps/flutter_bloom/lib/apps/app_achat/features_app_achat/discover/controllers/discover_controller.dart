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
import 'package:qyflutter/apps/app_achat/models_app_achat/discover_item_model.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/storage/storage_manager.dart';

class DiscoverController extends ChangeNotifier {
  final StorageManager _storageManager = StorageManager.instance;
  static const String _boxName = 'achat_discover';
  static const String _discoverCacheKey = 'discover_items';
  static const String _discoverFavoritesKey = 'discover_favorites';

  List<DiscoverItemModel> _allItems = [];
  List<DiscoverItemModel> _filteredItems = [];
  bool _isLoading = false;
  String? _errorMessage;
  DiscoverItemType? _selectedType;

  // Getters
  List<DiscoverItemModel> get allItems => _allItems;
  List<DiscoverItemModel> get discoverItems => _allItems;
  List<DiscoverItemModel> get filteredItems => _filteredItems;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  DiscoverItemType? get selectedType => _selectedType;

  // Load items
  Future<void> loadItems() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Try to get cached data first
      final cachedData = await _storageManager.getValue<List>(_boxName, _discoverCacheKey);
      if (cachedData != null) {
        _allItems = cachedData
            .map((item) => DiscoverItemModel.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        // Return default data if no cache
        _allItems = _getMockItems();

        // Cache the default data
        try {
          await _storageManager.putValue(
            _boxName,
            _discoverCacheKey,
            _allItems.map((item) => item.toJson()).toList(),
          );
        } catch (e) {
          // Cache failure is not critical
        }
      }

      _filteredItems = List.from(_allItems);
      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Failed to load discover items';
      // Fallback to mock data
      _allItems = _getMockItems();
      _filteredItems = List.from(_allItems);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Refresh items
  Future<void> refreshItems() async {
    await loadItems();
  }

  // Filter by type
  void filterByType(DiscoverItemType type) {
    _selectedType = type;
    _filteredItems = _allItems.where((item) => item.type == type).toList();
    notifyListeners();
  }

  // Clear filter
  void clearFilter() {
    _selectedType = null;
    _filteredItems = List.from(_allItems);
    notifyListeners();
  }

  // Update search query
  void updateSearchQuery(String query) {
    if (query.isEmpty) {
      _filteredItems = List.from(_allItems);
    } else {
      _filteredItems = _allItems.where((item) =>
        item.title.toLowerCase().contains(query.toLowerCase()) ||
        item.description.toLowerCase().contains(query.toLowerCase())
      ).toList();
    }
    notifyListeners();
  }

  // Handle item tap
  void onItemTap(BuildContext context, DiscoverItemModel item) {
    switch (item.type) {
      case DiscoverItemType.moments:
        _showComingSoonMessage(context, 'achat_discover_moments_coming_soon');
        break;
      case DiscoverItemType.channels:
        _showComingSoonMessage(context, 'achat_discover_channels_coming_soon');
        break;
      case DiscoverItemType.games:
        _showComingSoonMessage(context, 'achat_discover_games_coming_soon');
        break;
      case DiscoverItemType.miniPrograms:
        _showComingSoonMessage(context, 'achat_discover_mini_programs_coming_soon');
        break;
    }
  }

  void _showComingSoonMessage(BuildContext context, String messageKey) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(messageKey.tr(context)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  // Favorites functionality
  Future<void> addToFavorites(String itemId) async {
    try {
      final favorites = await getFavoriteItemIds();
      if (!favorites.contains(itemId)) {
        favorites.add(itemId);
        await _storageManager.putValue(_boxName, _discoverFavoritesKey, favorites);
      }
    } catch (e) {
      // Favorite operation failure is not critical
    }
  }

  Future<void> removeFromFavorites(String itemId) async {
    try {
      final favorites = await getFavoriteItemIds();
      favorites.remove(itemId);
      await _storageManager.putValue(_boxName, _discoverFavoritesKey, favorites);
    } catch (e) {
      // Favorite operation failure is not critical
    }
  }

  Future<bool> isFavorite(String itemId) async {
    final favorites = await getFavoriteItemIds();
    return favorites.contains(itemId);
  }

  Future<List<String>> getFavoriteItemIds() async {
    try {
      final favorites = await _storageManager.getValue<List>(_boxName, _discoverFavoritesKey);
      if (favorites != null) {
        return favorites.cast<String>();
      }
    } catch (e) {
      // If cache fails, return empty list
    }
    return [];
  }

  // Mock data
  List<DiscoverItemModel> _getMockItems() {
    return [
      const DiscoverItemModel(
        id: '1',
        title: 'Moments',
        description: 'Share your life moments with friends',
        type: DiscoverItemType.moments,
        isNew: true,
        userCount: 1500000,
      ),
      const DiscoverItemModel(
        id: '2',
        title: 'Live Channels',
        description: 'Watch live streams and broadcasts',
        type: DiscoverItemType.channels,
        isPopular: true,
        userCount: 850000,
      ),
      const DiscoverItemModel(
        id: '3',
        title: 'Mini Games',
        description: 'Play games with your friends',
        type: DiscoverItemType.games,
        userCount: 2300000,
      ),
      const DiscoverItemModel(
        id: '4',
        title: 'Mini Programs',
        description: 'Useful tools and utilities',
        type: DiscoverItemType.miniPrograms,
        isNew: true,
        userCount: 650000,
      ),
      const DiscoverItemModel(
        id: '5',
        title: 'Gaming Hub',
        description: 'Discover new games and tournaments',
        type: DiscoverItemType.games,
        isPopular: true,
        userCount: 1200000,
      ),
      const DiscoverItemModel(
        id: '6',
        title: 'Shopping Assistant',
        description: 'Smart shopping recommendations',
        type: DiscoverItemType.miniPrograms,
        userCount: 450000,
      ),
    ];
  }
}