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
import '../../../provider_app_travel/city_provider_app_travel.dart';

class CityScreen extends StatefulWidget {
  const CityScreen({super.key});

  @override
  State<CityScreen> createState() => _CityScreenState();
}

class _CityScreenState extends State<CityScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final provider = context.read<CityProviderAppTravel>();
    provider.searchCities(_searchController.text);
  }

  void _onCitySelected(String cityName) {
    final provider = context.read<CityProviderAppTravel>();
    provider.selectCity(cityName);
    Navigator.of(context).pop(cityName);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<CityProviderAppTravel>(
      builder: (context, cityProvider, child) {
        return Scaffold(
          backgroundColor: Colors.grey[100],
          appBar: AppBar(
            title: const Text('Select City'),
            elevation: 0,
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(60),
              child: Container(
                color: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search city',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              cityProvider.clearSearch();
                            },
                          )
                        : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide.none,
                    ),
                    filled: true,
                    fillColor: Colors.grey[200],
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
              ),
            ),
          ),
          body: cityProvider.isLoading
              ? const Center(child: CircularProgressIndicator())
              : cityProvider.hasError
                  ? _buildErrorView(cityProvider)
                  : _buildContent(cityProvider),
        );
      },
    );
  }

  Widget _buildErrorView(CityProviderAppTravel provider) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: Colors.red),
          const SizedBox(height: 16),
          Text(
            'Failed to load cities',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            provider.errorMessage ?? 'Unknown error',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => provider.clearError(),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(CityProviderAppTravel provider) {
    if (provider.searchQuery.isNotEmpty) {
      return _buildSearchResults(provider);
    }

    return Stack(
      children: [
        CustomScrollView(
          controller: _scrollController,
          slivers: [
            if (provider.searchHistory.isNotEmpty) _buildSearchHistory(provider),
            if (provider.hotCities.isNotEmpty) _buildHotCities(provider),
            _buildAlphabeticalCities(provider),
          ],
        ),
        _buildIndexBar(provider),
      ],
    );
  }

  Widget _buildSearchResults(CityProviderAppTravel provider) {
    if (provider.searchResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No cities found',
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: provider.searchResults.length,
      itemBuilder: (context, index) {
        final city = provider.searchResults[index];
        return ListTile(
          title: Text(city.name),
          subtitle: Text(city.spell),
          onTap: () => _onCitySelected(city.name),
        );
      },
    );
  }

  Widget _buildSearchHistory(CityProviderAppTravel provider) {
    return SliverToBoxAdapter(
      child: Container(
        color: Colors.white,
        margin: const EdgeInsets.only(bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Search History',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  TextButton(
                    onPressed: () => provider.clearSearchHistory(),
                    child: const Text('Clear'),
                  ),
                ],
              ),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: provider.searchHistory
                  .map((city) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: ActionChip(
                          label: Text(city),
                          onPressed: () => _onCitySelected(city),
                        ),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildHotCities(CityProviderAppTravel provider) {
    return SliverToBoxAdapter(
      child: Container(
        color: Colors.white,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Hot Cities',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 2.5,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: provider.hotCities.length,
              itemBuilder: (context, index) {
                final city = provider.hotCities[index];
                return OutlinedButton(
                  onPressed: () => _onCitySelected(city.name),
                  child: Text(city.name),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlphabeticalCities(CityProviderAppTravel provider) {
    final letters = provider.allLetters;

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final letter = letters[index];
          final cities = provider.getCitiesByLetter(letter);

          return Container(
            color: Colors.white,
            margin: const EdgeInsets.only(bottom: 1),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  color: Colors.grey[200],
                  child: Text(
                    letter,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue,
                    ),
                  ),
                ),
                ...cities.map((city) => ListTile(
                      title: Text(city.name),
                      onTap: () => _onCitySelected(city.name),
                    )),
              ],
            ),
          );
        },
        childCount: letters.length,
      ),
    );
  }

  Widget _buildIndexBar(CityProviderAppTravel provider) {
    final letters = provider.allLetters;

    return Positioned(
      right: 0,
      top: 0,
      bottom: 0,
      child: Container(
        width: 24,
        alignment: Alignment.center,
        child: ListView.builder(
          shrinkWrap: true,
          itemCount: letters.length,
          itemBuilder: (context, index) {
            return GestureDetector(
              onTap: () {
                double position = 0;

                if (provider.searchHistory.isNotEmpty) position += 150;
                if (provider.hotCities.isNotEmpty) position += 250;

                for (int i = 0; i < index; i++) {
                  final citiesCount = provider.getCitiesByLetter(letters[i]).length;
                  position += 40 + (citiesCount * 56);
                }

                _scrollController.animateTo(
                  position,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                );
              },
              child: Container(
                height: 16,
                alignment: Alignment.center,
                child: Text(
                  letters[index],
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.blue,
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
