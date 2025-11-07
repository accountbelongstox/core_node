import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/golf/controllers/golf_controller.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';

class VipClubGolfListScreen extends StatefulWidget {
  const VipClubGolfListScreen({super.key});

  @override
  State<VipClubGolfListScreen> createState() => _VipClubGolfListScreenState();
}

class _VipClubGolfListScreenState extends State<VipClubGolfListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VipClubGolfController>().loadGolfCourses();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Golf Courses',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.successGreen,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: Consumer<VipClubGolfController>(
        builder: (context, controller, child) {
          if (controller.isLoading) {
            return Center(
              child: CircularProgressIndicator(
                color: ThemeColors.successGreen,
              ),
            );
          }

          if (controller.errorMessage != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.error_outline,
                    size: 64,
                    color: ThemeColors.errorRed,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    controller.errorMessage!,
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.errorRed,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: ThemeDimensions.largePadding),
                  ElevatedButton(
                    onPressed: () => controller.loadGolfCourses(),
                    child: Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (controller.golfCourses.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.golf_course,
                    size: 64,
                    color: ThemeColors.neutralGrey,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    'No golf courses available',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => controller.loadGolfCourses(),
            child: ListView.builder(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              itemCount: controller.golfCourses.length,
              itemBuilder: (context, index) {
                final course = controller.golfCourses[index];
                return _buildCourseCard(context, course);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildCourseCard(
    BuildContext context,
    VipClubGolfCourseModel course,
  ) {
    return Card(
      margin: EdgeInsets.only(bottom: ThemeDimensions.defaultPadding),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: InkWell(
        onTap: () {
          context.push('${VipClubRoutes.golf}/${course.id}');
        },
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (course.imageUrl != null && course.imageUrl!.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(ThemeDimensions.defaultRadius),
                  topRight: Radius.circular(ThemeDimensions.defaultRadius),
                ),
                child: Image.network(
                  course.imageUrl!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 180,
                      color: ThemeColors.successGreen.withOpacity(0.2),
                      child: Icon(
                        Icons.golf_course,
                        size: 64,
                        color: ThemeColors.successGreen,
                      ),
                    );
                  },
                ),
              ),
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          course.name,
                          style: ThemeTextStyles.headlineSmall.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      if (course.vipOnly)
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.smallPadding,
                            vertical: ThemeDimensions.tinyPadding,
                          ),
                          decoration: BoxDecoration(
                            color: ThemeColors.accentGold,
                            borderRadius: BorderRadius.circular(
                              ThemeDimensions.smallRadius,
                            ),
                          ),
                          child: Text(
                            'VIP',
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: ThemeColors.neutralWhite,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.smallPadding),
                  Text(
                    course.description,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        size: 18,
                        color: ThemeColors.neutralGrey,
                      ),
                      SizedBox(width: ThemeDimensions.tinyPadding),
                      Expanded(
                        child: Text(
                          course.location,
                          style: ThemeTextStyles.bodySmall.copyWith(
                            color: ThemeColors.neutralGrey,
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.smallPadding),
                  Row(
                    children: [
                      _buildInfoChip(Icons.flag, '${course.holes} Holes'),
                      SizedBox(width: ThemeDimensions.smallPadding),
                      _buildInfoChip(
                        Icons.straighten,
                        '${course.par} Par',
                      ),
                      Spacer(),
                      Text(
                        '\$${course.basePrice}',
                        style: ThemeTextStyles.headlineSmall.copyWith(
                          color: ThemeColors.successGreen,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Wrap(
                    spacing: ThemeDimensions.tinyPadding,
                    children: [
                      Icon(
                        Icons.star,
                        size: 16,
                        color: ThemeColors.warningYellow,
                      ),
                      Text(
                        '${course.difficulty} difficulty',
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ThemeColors.neutralGrey,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String label) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.smallPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.successGreen.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.smallRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: ThemeColors.successGreen,
          ),
          SizedBox(width: ThemeDimensions.tinyPadding),
          Text(
            label,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.successGreen,
            ),
          ),
        ],
      ),
    );
  }
}
