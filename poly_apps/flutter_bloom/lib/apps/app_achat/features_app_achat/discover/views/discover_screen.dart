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
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/widgets/custom_loader.dart';
import 'package:qyflutter/common/widgets/no_data_screen.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/discover/controllers/discover_controller.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/discover/widgets/discover_app_bar.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/discover/widgets/discover_item_card.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/discover/widgets/discover_section_header.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/common_widgets/bottom_navigation/common_bottom_navigation.dart';

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  bool _showSearch = false;

  void _toggleSearch() {
    setState(() {
      _showSearch = !_showSearch;
      if (!_showSearch) {
        context.read<DiscoverController>().updateSearchQuery('');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => DiscoverController()..loadItems(),
      child: Scaffold(
        appBar: DiscoverAppBar(
          showSearch: _showSearch,
          onSearchToggle: _toggleSearch,
          onSearchChanged: (query) {
            context.read<DiscoverController>().updateSearchQuery(query);
          },
          onRefresh: () {
            context.read<DiscoverController>().refreshItems();
          },
        ),
        body: Consumer<DiscoverController>(
          builder: (context, controller, child) {
            if (controller.isLoading) {
              return const Center(child: CustomLoader());
            }

            final items = _showSearch
              ? controller.filteredItems
              : controller.discoverItems;

            if (items.isEmpty) {
              return NoDataScreen(
                title: _showSearch
                  ? 'achat_contacts_no_search_results'.tr(context)
                  : 'achat_discover_more_coming'.tr(context),
              );
            }

            return RefreshIndicator(
              onRefresh: () async {
                await controller.refreshItems();
              },
              child: ListView(
                padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
                children: [
                  if (!_showSearch) ...[
                    DiscoverSectionHeader(
                      title: 'achat_discover_popular'.tr(context),
                    ),
                    SizedBox(height: ThemeDimensions.paddingSizeDefault),
                  ],

                  ...items.map((item) => Padding(
                    padding: EdgeInsets.only(bottom: ThemeDimensions.paddingSizeSmall),
                    child: DiscoverItemCard(
                      item: item,
                      onTap: () => controller.onItemTap(context, item),
                    ),
                  )),

                  if (!_showSearch) ...[
                    SizedBox(height: ThemeDimensions.paddingSizeLarge),
                    Center(
                      child: Column(
                        children: [
                          Icon(
                            Icons.explore_outlined,
                            size: 48,
                            color: Theme.of(context).unselectedWidgetColor,
                          ),
                          SizedBox(height: ThemeDimensions.paddingSizeDefault),
                          Text(
                            'achat_discover_more_coming'.tr(context),
                            style: ThemeTextStyles.bodyLarge.copyWith(
                              color: Theme.of(context).textTheme.bodySmall?.color,
                            ),
                          ),
                          SizedBox(height: ThemeDimensions.paddingSizeSmall),
                          Text(
                            'achat_discover_stay_tuned'.tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: Theme.of(context).textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
        bottomNavigationBar: const CommonBottomNavigation(
          currentIndex: 2,
        ),
      ),
    );
  }
}