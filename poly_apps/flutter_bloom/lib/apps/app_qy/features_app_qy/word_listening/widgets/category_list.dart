/// Category list widget for word listening
library category_list;

import 'package:flutter/material.dart';
import '../../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../../common/theme/app_theme.dart';

class CategoryList extends StatefulWidget {
  final ListeningCategory selectedCategory;
  final Function(ListeningCategory) onCategorySelected;

  const CategoryList({
    super.key,
    required this.selectedCategory,
    required this.onCategorySelected,
  });

  @override
  State<CategoryList> createState() => _CategoryListState();
}

class _CategoryListState extends State<CategoryList> {
  @override
  Widget build(BuildContext context) {
    final categories = [
      CategoryItem(
        category: ListeningCategory.wordBook,
        label: 'wordListening.wordBook'.tr,
        count: 200,
        color: AppTheme.primaryGreen,
      ),
      CategoryItem(
        category: ListeningCategory.newWords,
        label: 'wordListening.newWords'.tr,
        count: 27,
        color: Colors.orange,
      ),
      CategoryItem(
        category: ListeningCategory.todayNew,
        label: 'wordListening.todayNew'.tr,
        count: 27,
        color: AppTheme.secondaryGreen,
      ),
      CategoryItem(
        category: ListeningCategory.todayReview,
        label: 'wordListening.todayReview'.tr,
        count: 27,
        color: AppTheme.accentGreen,
      ),
    ];

    final bottomCategories = [
      CategoryItem(
        category: ListeningCategory.fullList,
        label: 'wordListening.fullList'.tr,
        count: 16952,
        color: AppTheme.primaryGreen,
      ),
      CategoryItem(
        category: ListeningCategory.fullUnlearned,
        label: 'wordListening.fullUnlearned'.tr,
        count: 16925,
        color: Colors.red,
      ),
      CategoryItem(
        category: ListeningCategory.fullLearning,
        label: 'wordListening.fullLearning'.tr,
        count: 27,
        color: AppTheme.secondaryGreen,
      ),
      CategoryItem(
        category: ListeningCategory.fullSimple,
        label: 'wordListening.fullSimple'.tr,
        count: 27,
        color: Colors.grey,
      ),
    ];

    return Column(
      children: [
        SizedBox(
          height: 50,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: categories.length,
            itemBuilder: (context, index) {
              final category = categories[index];
              final isSelected = category.category == widget.selectedCategory;

              return Padding(
                padding: EdgeInsets.only(
                  left: index == 0 ? 16 : 8,
                  right: index == categories.length - 1 ? 16 : 8,
                ),
                child: GestureDetector(
                  onTap: () => widget.onCategorySelected(category.category),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? LinearGradient(
                              colors: [
                                category.color.withOpacity(0.8),
                                category.color.withOpacity(0.6),
                              ],
                            )
                          : null,
                      color: isSelected ? null : Colors.white,
                      borderRadius: BorderRadius.circular(25),
                      border: Border.all(
                        color: isSelected ? category.color : Colors.grey.shade300,
                        width: isSelected ? 0 : 1,
                      ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: category.color.withOpacity(0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          category.label,
                          style: TextStyle(
                            color: isSelected ? Colors.white : AppTheme.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? Colors.white.withOpacity(0.2)
                                : category.color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${category.count}',
                            style: TextStyle(
                              color: isSelected ? Colors.white : category.color,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 50,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: bottomCategories.length,
            itemBuilder: (context, index) {
              final category = bottomCategories[index];
              final isSelected = category.category == widget.selectedCategory;

              return Padding(
                padding: EdgeInsets.only(
                  left: index == 0 ? 16 : 8,
                  right: index == bottomCategories.length - 1 ? 16 : 8,
                ),
                child: GestureDetector(
                  onTap: () => widget.onCategorySelected(category.category),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? LinearGradient(
                              colors: [
                                category.color.withOpacity(0.8),
                                category.color.withOpacity(0.6),
                              ],
                            )
                          : null,
                      color: isSelected ? null : Colors.white,
                      borderRadius: BorderRadius.circular(25),
                      border: Border.all(
                        color: isSelected ? category.color : Colors.grey.shade300,
                        width: isSelected ? 0 : 1,
                      ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: category.color.withOpacity(0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          category.label,
                          style: TextStyle(
                            color: isSelected ? Colors.white : AppTheme.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? Colors.white.withOpacity(0.2)
                                : category.color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${category.count}',
                            style: TextStyle(
                              color: isSelected ? Colors.white : category.color,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class CategoryItem {
  final ListeningCategory category;
  final String label;
  final int count;
  final Color color;

  CategoryItem({
    required this.category,
    required this.label,
    required this.count,
    required this.color,
  });
}

enum ListeningCategory {
  wordBook,
  newWords,
  todayNew,
  todayReview,
  fullList,
  fullUnlearned,
  fullLearning,
  fullSimple,
}