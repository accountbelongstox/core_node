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

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/course_controller_app_qy.dart';

class CourseSearchScreenRefactoredAppQy extends StatefulWidget {
  const CourseSearchScreenRefactoredAppQy({super.key});

  @override
  State<CourseSearchScreenRefactoredAppQy> createState() =>
      _CourseSearchScreenRefactoredAppQyState();
}

class _CourseSearchScreenRefactoredAppQyState
    extends State<CourseSearchScreenRefactoredAppQy> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedFilter = 'all';
  final List<Map<String, dynamic>> _searchResults = [];
  final List<String> _recentSearches = [];
  final List<String> _popularSearches = [];

  @override
  void initState() {
    super.initState();
    _initSearchData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _initSearchData() {
    _recentSearches.addAll([
      'Business English',
      'IELTS Preparation',
      'Daily Conversation',
    ]);

    _popularSearches.addAll([
      'TOEFL',
      'Travel English',
      'Academic Writing',
      'Pronunciation',
      'Grammar',
      'Vocabulary Building',
    ]);

    _searchResults.addAll([
      {
        'title': 'Business English Communication',
        'level': 'Intermediate',
        'lessons': 20,
        'duration': '8 weeks',
        'rating': 4.8,
        'students': 1250,
        'category': 'Business',
      },
      {
        'title': 'IELTS Speaking Mastery',
        'level': 'Advanced',
        'lessons': 30,
        'duration': '12 weeks',
        'rating': 4.9,
        'students': 2100,
        'category': 'Test Prep',
      },
      {
        'title': 'Daily English Conversation',
        'level': 'Beginner',
        'lessons': 15,
        'duration': '6 weeks',
        'rating': 4.7,
        'students': 3500,
        'category': 'General',
      },
      {
        'title': 'Academic Writing Excellence',
        'level': 'Advanced',
        'lessons': 25,
        'duration': '10 weeks',
        'rating': 4.8,
        'students': 890,
        'category': 'Academic',
      },
    ]);
  }

  void _performSearch(String query) {
    setState(() {
      _searchQuery = query;
      if (query.isNotEmpty && !_recentSearches.contains(query)) {
        _recentSearches.insert(0, query);
        if (_recentSearches.length > 5) {
          _recentSearches.removeLast();
        }
      }
    });
  }

  void _clearSearch() {
    setState(() {
      _searchController.clear();
      _searchQuery = '';
    });
  }

  void _selectFilter(String filter) {
    setState(() {
      _selectedFilter = filter;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySearchCourses.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          _buildFilterChips(),
          Expanded(
            child: _searchQuery.isEmpty
                ? _buildSearchSuggestions()
                : _buildSearchResults(),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          bottom: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: TextField(
        controller: _searchController,
        onChanged: _performSearch,
        style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textPrimary),
        decoration: InputDecoration(
          hintText: QyAppLocalizationKeys.qySearchCourses.tr(context),
          hintStyle: ThemeTextStyles.body1.copyWith(
            color: ThemeColors.textTertiary,
          ),
          prefixIcon: Icon(Icons.search, color: ThemeColors.textSecondary),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  onPressed: _clearSearch,
                  icon: Icon(Icons.clear, color: ThemeColors.textSecondary),
                )
              : null,
          filled: true,
          fillColor: ThemeColors.background,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            borderSide: BorderSide.none,
          ),
          contentPadding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingMedium,
            vertical: ThemeDimensions.paddingSmall,
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      {'id': 'all', 'label': QyAppLocalizationKeys.qyAll.tr(context)},
      {'id': 'business', 'label': QyAppLocalizationKeys.qyBusiness.tr(context)},
      {'id': 'test', 'label': QyAppLocalizationKeys.qyTestPrep.tr(context)},
      {'id': 'general', 'label': QyAppLocalizationKeys.qyGeneral.tr(context)},
      {'id': 'academic', 'label': QyAppLocalizationKeys.qyAcademic.tr(context)},
    ];

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingMedium,
        vertical: ThemeDimensions.paddingSmall,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          bottom: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: filters.map((filter) {
            final isSelected = _selectedFilter == filter['id'];
            return Padding(
              padding: EdgeInsets.only(right: ThemeDimensions.spacingSmall),
              child: FilterChip(
                label: Text(filter['label'] as String),
                selected: isSelected,
                onSelected: (_) => _selectFilter(filter['id'] as String),
                backgroundColor: ThemeColors.background,
                selectedColor: ThemeColors.primary.withOpacity(0.1),
                labelStyle: ThemeTextStyles.body2.copyWith(
                  color: isSelected ? ThemeColors.primary : ThemeColors.textSecondary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
                side: BorderSide(
                  color: isSelected ? ThemeColors.primary : ThemeColors.border,
                ),
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingMedium,
                  vertical: ThemeDimensions.paddingXSmall,
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildSearchSuggestions() {
    return ListView(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      children: [
        if (_recentSearches.isNotEmpty) ...{
          _buildSuggestionSection(
            QyAppLocalizationKeys.qyRecentSearches.tr(context),
            _recentSearches,
            Icons.history,
            true,
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
        },
        _buildSuggestionSection(
          QyAppLocalizationKeys.qyPopularSearches.tr(context),
          _popularSearches,
          Icons.trending_up,
          false,
        ),
      ],
    );
  }

  Widget _buildSuggestionSection(
    String title,
    List<String> items,
    IconData icon,
    bool showDelete,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 20, color: ThemeColors.textSecondary),
            SizedBox(width: ThemeDimensions.spacingSmall),
            Text(
              title,
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacingMedium),
        Wrap(
          spacing: ThemeDimensions.spacingSmall,
          runSpacing: ThemeDimensions.spacingSmall,
          children: items.map((item) {
            return InkWell(
              onTap: () {
                _searchController.text = item;
                _performSearch(item);
              },
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.paddingMedium,
                  vertical: ThemeDimensions.paddingSmall,
                ),
                decoration: BoxDecoration(
                  color: ThemeColors.surface,
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                  border: Border.all(color: ThemeColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      item,
                      style: ThemeTextStyles.body2.copyWith(
                        color: ThemeColors.textPrimary,
                      ),
                    ),
                    if (showDelete) ...{
                      SizedBox(width: ThemeDimensions.spacingSmall),
                      Icon(
                        Icons.close,
                        size: 14,
                        color: ThemeColors.textTertiary,
                      ),
                    },
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildSearchResults() {
    return ListView.builder(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      itemCount: _searchResults.length,
      itemBuilder: (context, index) {
        return Padding(
          padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
          child: _buildCourseCard(_searchResults[index]),
        );
      },
    );
  }

  Widget _buildCourseCard(Map<String, dynamic> course) {
    return InkWell(
      onTap: () {},
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          border: Border.all(color: ThemeColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        ThemeColors.primary,
                        ThemeColors.primary.withOpacity(0.8),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                  ),
                  child: Icon(
                    Icons.school,
                    size: 40,
                    color: ThemeColors.surface,
                  ),
                ),
                SizedBox(width: ThemeDimensions.spacingMedium),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        course['title'] as String,
                        style: ThemeTextStyles.body1.copyWith(
                          color: ThemeColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: ThemeDimensions.spacingSmall),
                      Row(
                        children: [
                          Icon(Icons.star, size: 16, color: Colors.amber),
                          SizedBox(width: ThemeDimensions.spacingXSmall),
                          Text(
                            course['rating'].toString(),
                            style: ThemeTextStyles.caption.copyWith(
                              color: ThemeColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          SizedBox(width: ThemeDimensions.spacingSmall),
                          Text(
                            '(${course['students']})',
                            style: ThemeTextStyles.caption.copyWith(
                              color: ThemeColors.textTertiary,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: ThemeDimensions.spacingSmall),
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: ThemeDimensions.paddingSmall,
                          vertical: ThemeDimensions.paddingXSmall,
                        ),
                        decoration: BoxDecoration(
                          color: ThemeColors.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                        ),
                        child: Text(
                          course['level'] as String,
                          style: ThemeTextStyles.caption.copyWith(
                            color: ThemeColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Divider(height: 1, color: ThemeColors.border),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Row(
              children: [
                Icon(Icons.play_circle_outline, size: 16, color: ThemeColors.textSecondary),
                SizedBox(width: ThemeDimensions.spacingXSmall),
                Text(
                  '${course['lessons']} ${QyAppLocalizationKeys.qyLessons.tr(context)}',
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
                SizedBox(width: ThemeDimensions.spacingMedium),
                Icon(Icons.access_time, size: 16, color: ThemeColors.textSecondary),
                SizedBox(width: ThemeDimensions.spacingXSmall),
                Text(
                  course['duration'] as String,
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
