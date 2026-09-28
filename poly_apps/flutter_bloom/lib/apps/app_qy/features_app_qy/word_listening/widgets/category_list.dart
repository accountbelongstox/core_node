/// Category list widget for word listening
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, localization
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../models/word_audio_model.dart';

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
        label: QyAppLocalizationKeys.qyWordWordBook.tr(context),
        count: 200,
        color: ColorsAppQy.qyPrimary,
      ),
      CategoryItem(
        category: ListeningCategory.newWords,
        label: QyAppLocalizationKeys.qyWordBookNewWord.tr(context),
        count: 27,
        color: ColorsAppQy.qyWarning,
      ),
      CategoryItem(
        category: ListeningCategory.todayNew,
        label: QyAppLocalizationKeys.qyWordTodayNew.tr(context),
        count: 27,
        color: ColorsAppQy.qySecondary,
      ),
      CategoryItem(
        category: ListeningCategory.todayReview,
        label: QyAppLocalizationKeys.qyWordReview.tr(context),
        count: 27,
        color: ColorsAppQy.qyAccent,
      ),
    ];

    final bottomCategories = [
      CategoryItem(
        category: ListeningCategory.fullList,
        label: QyAppLocalizationKeys.qyWordBookAll.tr(context),
        count: 16952,
        color: ColorsAppQy.qyPrimary,
      ),
      CategoryItem(
        category: ListeningCategory.fullUnlearned,
        label: QyAppLocalizationKeys.qyWordBookNewWord.tr(context),
        count: 16925,
        color: ColorsAppQy.qyError,
      ),
      CategoryItem(
        category: ListeningCategory.fullLearning,
        label: QyAppLocalizationKeys.qyWordBookLearning.tr(context),
        count: 27,
        color: ColorsAppQy.qySecondary,
      ),
      CategoryItem(
        category: ListeningCategory.fullSimple,
        label: QyAppLocalizationKeys.qyWordBookAll.tr(context),
        count: 27,
        color: ColorsAppQy.qyTextTertiary,
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
                  left: index == 0 ? ThemeDimensions.spacing16 : ThemeDimensions.spacing8,
                  right: index == categories.length - 1 ? ThemeDimensions.spacing16 : ThemeDimensions.spacing8,
                ),
                child: BouncingButton(
                  onPressed: () => widget.onCategorySelected(category.category),
                  child: AnimatedContainer(
                    duration: Duration(milliseconds: ThemeDimensions.animationDurationNormal),
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.spacing16,
                      vertical: ThemeDimensions.spacing8,
                    ),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? LinearGradient(
                              colors: [
                                category.color.withOpacity(0.8),
                                category.color.withOpacity(0.6),
                              ],
                            )
                          : null,
                      color: isSelected ? null : ColorsAppQy.qyFrostWhite,
                      borderRadius: ThemeDimensions.borderRadiusL,
                      border: Border.all(
                        color: isSelected ? category.color : ColorsAppQy.qyBorderLight,
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
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: isSelected ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(width: ThemeDimensions.spacing8),
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.spacing6,
                            vertical: ThemeDimensions.spacing2,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.2)
                                : category.color.withOpacity(0.1),
                            borderRadius: ThemeDimensions.borderRadiusS,
                          ),
                          child: Text(
                            '${category.count}',
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: isSelected ? ColorsAppQy.qyTextOnPrimary : category.color,
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
        SizedBox(height: ThemeDimensions.spacing8),
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
                  left: index == 0 ? ThemeDimensions.spacing16 : ThemeDimensions.spacing8,
                  right: index == bottomCategories.length - 1 ? ThemeDimensions.spacing16 : ThemeDimensions.spacing8,
                ),
                child: BouncingButton(
                  onPressed: () => widget.onCategorySelected(category.category),
                  child: AnimatedContainer(
                    duration: Duration(milliseconds: ThemeDimensions.animationDurationNormal),
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.spacing16,
                      vertical: ThemeDimensions.spacing8,
                    ),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? LinearGradient(
                              colors: [
                                category.color.withOpacity(0.8),
                                category.color.withOpacity(0.6),
                              ],
                            )
                          : null,
                      color: isSelected ? null : ColorsAppQy.qyFrostWhite,
                      borderRadius: ThemeDimensions.borderRadiusL,
                      border: Border.all(
                        color: isSelected ? category.color : ColorsAppQy.qyBorderLight,
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
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: isSelected ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(width: ThemeDimensions.spacing8),
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.spacing6,
                            vertical: ThemeDimensions.spacing2,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.2)
                                : category.color.withOpacity(0.1),
                            borderRadius: ThemeDimensions.borderRadiusS,
                          ),
                          child: Text(
                            '${category.count}',
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: isSelected ? ColorsAppQy.qyTextOnPrimary : category.color,
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

