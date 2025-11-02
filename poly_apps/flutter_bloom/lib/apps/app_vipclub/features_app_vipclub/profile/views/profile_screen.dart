import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';

class VipClubProfileScreen extends StatelessWidget {
  const VipClubProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'My Profile',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
        actions: [
          IconButton(
            icon: Icon(Icons.settings),
            onPressed: () {
              context.push(VipClubRoutes.settings);
            },
          ),
        ],
      ),
      body: Consumer<VipClubAuthController>(
        builder: (context, authController, child) {
          final user = authController.currentUser;

          if (user == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.person_off,
                    size: 64,
                    color: ThemeColors.neutralGrey,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    'Not logged in',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.largePadding),
                  ElevatedButton(
                    onPressed: () {
                      context.go(VipClubRoutes.login);
                    },
                    child: Text('Login'),
                  ),
                ],
              ),
            );
          }

          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildProfileHeader(context, user),
                SizedBox(height: ThemeDimensions.defaultPadding),
                _buildMembershipCard(context, user),
                SizedBox(height: ThemeDimensions.defaultPadding),
                _buildStatsSection(user),
                SizedBox(height: ThemeDimensions.defaultPadding),
                _buildActionSection(context, authController),
                SizedBox(height: ThemeDimensions.hugePadding),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildProfileHeader(BuildContext context, user) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.hugePadding),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            ThemeColors.primaryBlue,
            ThemeColors.primaryBlue.withOpacity(0.8),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 50,
            backgroundColor: ThemeColors.neutralWhite,
            child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                ? ClipOval(
                    child: Image.network(
                      user.avatarUrl!,
                      width: 100,
                      height: 100,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Icon(
                          Icons.person,
                          size: 50,
                          color: ThemeColors.primaryBlue,
                        );
                      },
                    ),
                  )
                : Icon(
                    Icons.person,
                    size: 50,
                    color: ThemeColors.primaryBlue,
                  ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Text(
            user.fullName,
            style: ThemeTextStyles.headlineMedium.copyWith(
              color: ThemeColors.neutralWhite,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.tinyPadding),
          Text(
            user.email,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralWhite.withOpacity(0.9),
            ),
          ),
          if (user.phone.isNotEmpty) ...[
            SizedBox(height: ThemeDimensions.tinyPadding),
            Text(
              user.phone,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.neutralWhite.withOpacity(0.9),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMembershipCard(BuildContext context, user) {
    Color memberColor;
    String memberTitle;

    switch (user.memberType) {
      case 'diamond':
        memberColor = ThemeColors.accentPurple;
        memberTitle = 'Diamond Member';
        break;
      case 'platinum':
        memberColor = ThemeColors.neutralGrey;
        memberTitle = 'Platinum Member';
        break;
      case 'gold':
        memberColor = ThemeColors.accentGold;
        memberTitle = 'Gold Member';
        break;
      case 'regular':
        memberColor = ThemeColors.successGreen;
        memberTitle = 'Regular Member';
        break;
      default:
        memberColor = ThemeColors.neutralGrey;
        memberTitle = 'Guest';
    }

    return Container(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: memberColor,
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        boxShadow: [
          BoxShadow(
            color: memberColor.withOpacity(0.3),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.stars,
                color: ThemeColors.neutralWhite,
                size: 24,
              ),
              SizedBox(width: ThemeDimensions.smallPadding),
              Text(
                memberTitle,
                style: ThemeTextStyles.headlineSmall.copyWith(
                  color: ThemeColors.neutralWhite,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'VIP Points',
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ThemeColors.neutralWhite.withOpacity(0.8),
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.tinyPadding),
                  Text(
                    '${user.vipPoints}',
                    style: ThemeTextStyles.headlineMedium.copyWith(
                      color: ThemeColors.neutralWhite,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'Discount',
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ThemeColors.neutralWhite.withOpacity(0.8),
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.tinyPadding),
                  Text(
                    '${(user.discountRate * 100).toInt()}%',
                    style: ThemeTextStyles.headlineMedium.copyWith(
                      color: ThemeColors.neutralWhite,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Member since: ${_formatDate(user.memberSince)}',
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.neutralWhite.withOpacity(0.9),
                ),
              ),
              if (user.memberExpiry != null)
                Text(
                  'Expires: ${_formatDate(user.memberExpiry!)}',
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ThemeColors.neutralWhite.withOpacity(0.9),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatsSection(user) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'My Statistics',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            children: [
              Expanded(
                child: _buildStatCard(
                  icon: Icons.event_available,
                  label: 'Bookings',
                  value: '0',
                  color: ThemeColors.primaryBlue,
                ),
              ),
              SizedBox(width: ThemeDimensions.defaultPadding),
              Expanded(
                child: _buildStatCard(
                  icon: Icons.access_time,
                  label: 'Upcoming',
                  value: '0',
                  color: ThemeColors.successGreen,
                ),
              ),
              SizedBox(width: ThemeDimensions.defaultPadding),
              Expanded(
                child: _buildStatCard(
                  icon: Icons.check_circle,
                  label: 'Completed',
                  value: '0',
                  color: ThemeColors.accentGold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        border: Border.all(
          color: color.withOpacity(0.3),
        ),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            color: color,
            size: 28,
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            value,
            style: ThemeTextStyles.headlineMedium.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.tinyPadding),
          Text(
            label,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionSection(
    BuildContext context,
    VipClubAuthController authController,
  ) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Actions',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          _buildActionTile(
            context,
            icon: Icons.history,
            title: 'Booking History',
            onTap: () {
              context.push(VipClubRoutes.bookings);
            },
          ),
          _buildActionTile(
            context,
            icon: Icons.card_giftcard,
            title: 'My VIP Card',
            onTap: () {
              context.push(VipClubRoutes.vipCard);
            },
          ),
          _buildActionTile(
            context,
            icon: Icons.star,
            title: 'VIP Benefits',
            onTap: () {
              context.push(VipClubRoutes.vipBenefits);
            },
          ),
          _buildActionTile(
            context,
            icon: Icons.edit,
            title: 'Edit Profile',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Edit profile feature coming soon'),
                ),
              );
            },
          ),
          _buildActionTile(
            context,
            icon: Icons.logout,
            title: 'Logout',
            color: ThemeColors.errorRed,
            onTap: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: Text('Logout'),
                  content: Text('Are you sure you want to logout?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      child: Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      child: Text(
                        'Logout',
                        style: TextStyle(color: ThemeColors.errorRed),
                      ),
                    ),
                  ],
                ),
              );

              if (confirm == true && context.mounted) {
                await authController.logout();
                context.go(VipClubRoutes.login);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Color? color,
  }) {
    return Card(
      margin: EdgeInsets.only(bottom: ThemeDimensions.smallPadding),
      child: ListTile(
        leading: Icon(
          icon,
          color: color ?? ThemeColors.primaryBlue,
        ),
        title: Text(
          title,
          style: ThemeTextStyles.bodyLarge.copyWith(
            color: color ?? ThemeColors.neutralBlack,
          ),
        ),
        trailing: Icon(
          Icons.chevron_right,
          color: ThemeColors.neutralGrey,
        ),
        onTap: onTap,
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}
