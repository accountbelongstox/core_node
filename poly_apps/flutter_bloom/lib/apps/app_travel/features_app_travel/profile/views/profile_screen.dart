import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';
import '../../../resources_app_travel/assets_images_app_travel.dart';
import '../../../resources_app_travel/colors_app_travel.dart';
import '../../settings/views/settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<Map<String, dynamic>> _getStatsData(BuildContext context) {
    return [
      {'icon': Icons.local_activity, 'label': TravelLocalizationKeys.travelCoupon.tr(context), 'value': 10, 'hasBadge': true},
      {'icon': Icons.star_border, 'label': TravelLocalizationKeys.travelFavoritesAndViews.tr(context), 'value': 0, 'hasBadge': false},
      {'icon': Icons.account_balance_wallet, 'label': TravelLocalizationKeys.travelPoints.tr(context), 'value': 0, 'hasBadge': false},
    ];
  }

  List<Map<String, dynamic>> _getOrderActions(BuildContext context) {
    return [
      {'icon': Icons.credit_card, 'label': TravelLocalizationKeys.travelPendingPayment.tr(context)},
      {'icon': Icons.luggage, 'label': TravelLocalizationKeys.travelPendingTrip.tr(context)},
      {'icon': Icons.rate_review, 'label': TravelLocalizationKeys.travelPendingReview.tr(context)},
      {'icon': Icons.assignment_return, 'label': TravelLocalizationKeys.travelRefundAfterSales.tr(context)},
      {'icon': Icons.receipt_long, 'label': TravelLocalizationKeys.travelMyOrders.tr(context), 'isHighlight': true},
    ];
  }

  List<Map<String, dynamic>> _getFinancialServices(BuildContext context) {
    return [
      {'amount': '30万', 'title': TravelLocalizationKeys.travelCreditLoan.tr(context), 'subtitle': TravelLocalizationKeys.travelMaxAmount.tr(context)},
      {'amount': '10万', 'title': TravelLocalizationKeys.travelNakuHua.tr(context), 'subtitle': TravelLocalizationKeys.travelMaxCredit.tr(context)},
      {'amount': '50万', 'title': TravelLocalizationKeys.travelBusinessLoan.tr(context), 'subtitle': TravelLocalizationKeys.travelMaxAmount.tr(context)},
      {'amount': '20万', 'title': TravelLocalizationKeys.travelBankZone.tr(context), 'subtitle': TravelLocalizationKeys.travelMaxAmount.tr(context)},
    ];
  }

  List<Map<String, dynamic>> _getFunctionGrid(BuildContext context) {
    return [
      {'icon': Icons.info_outline, 'label': TravelLocalizationKeys.travelCommonInfo.tr(context)},
      {'icon': Icons.receipt, 'label': TravelLocalizationKeys.travelMyInvoice.tr(context)},
      {'icon': Icons.card_giftcard, 'label': TravelLocalizationKeys.travelRightsCard.tr(context)},
      {'icon': Icons.rate_review, 'label': TravelLocalizationKeys.travelMyReviews.tr(context)},
      {'icon': Icons.edit_note, 'label': TravelLocalizationKeys.travelMyNotes.tr(context)},
      {'icon': Icons.camera_alt, 'label': TravelLocalizationKeys.travelCreationCenter.tr(context)},
      {'icon': Icons.group, 'label': TravelLocalizationKeys.travelMyCommunity.tr(context)},
      {'icon': Icons.map, 'label': TravelLocalizationKeys.travelTravelFootprint.tr(context)},
      {'icon': Icons.feedback, 'label': TravelLocalizationKeys.travelComplaint.tr(context)},
      {'icon': Icons.credit_score, 'label': TravelLocalizationKeys.travelMyCredit.tr(context)},
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TravelColors.travelBackground,
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeader(),
            _buildMemberCard(),
            _buildStats(),
            _buildOrderActions(),
            _build12306Prompt(),
            _buildFinancialServices(),
            _buildFunctionGrid(),
            _buildRecommendation(),
            const SizedBox(height: 20.0),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final userProvider = context.watch<UserProviderAppTravel>();
    final user = userProvider.user;
    final username = user.username ?? TravelLocalizationKeys.travelGuestUser.tr(context);

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16.0, 48.0, 16.0, 16.0),
      child: Row(
        children: [
          Container(
            width: 60.0,
            height: 60.0,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: user.isLoggedIn ? TravelColors.travelPrimary : TravelColors.travelBorderLight,
                width: 2.0,
              ),
            ),
            child: ClipOval(
              child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                  ? Image.network(
                      user.avatarUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return _buildDefaultAvatar();
                      },
                    )
                  : Image.asset(
                      AssetsImagesAppTravel.travelUserAvatarDefault,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return _buildDefaultAvatar();
                      },
                    ),
            ),
          ),
          const SizedBox(width: 12.0),
          Text(
            username,
            style: const TextStyle(
              fontSize: 18.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: () {
              debugPrint('Hexagon icon tapped');
            },
            child: Container(
              width: 36.0,
              height: 36.0,
              decoration: BoxDecoration(
                color: TravelColors.travelBackground,
                borderRadius: BorderRadius.circular(6.0),
              ),
              child: const Icon(
                Icons.hexagon_outlined,
                size: 20.0,
                color: Colors.black54,
              ),
            ),
          ),
          const SizedBox(width: 8.0),
          GestureDetector(
            onTap: () {
              debugPrint('QR code scanner tapped');
            },
            child: Container(
              width: 36.0,
              height: 36.0,
              decoration: BoxDecoration(
                color: TravelColors.travelBackground,
                borderRadius: BorderRadius.circular(6.0),
              ),
              child: const Icon(
                Icons.qr_code_scanner,
                size: 20.0,
                color: Colors.black54,
              ),
            ),
          ),
          const SizedBox(width: 8.0),
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const SettingsScreen(),
                ),
              );
            },
            child: Container(
              width: 36.0,
              height: 36.0,
              decoration: BoxDecoration(
                color: TravelColors.travelBackground,
                borderRadius: BorderRadius.circular(6.0),
              ),
              child: const Icon(
                Icons.settings_outlined,
                size: 20.0,
                color: Colors.black54,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMemberCard() {
    return GestureDetector(
      onTap: () {
        debugPrint('Member card tapped');
      },
      child: Container(
        margin: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12.0),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 8.0,
              offset: const Offset(0, 2.0),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12.0),
          child: Image.asset(
            'assets/apps/app_travel/images/profile_member_banner.png',
            width: double.infinity,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: TravelColors.travelGradientLightBlue,
                  ),
                  borderRadius: BorderRadius.circular(12.0),
                ),
                child: Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          TravelLocalizationKeys.travelPublicMember.tr(context),
                          style: const TextStyle(
                            fontSize: 20.0,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4.0),
                        Row(
                          children: [
                            const Icon(
                              Icons.diamond,
                              size: 14.0,
                              color: Colors.black54,
                            ),
                            const SizedBox(width: 4.0),
                            Text(
                              TravelLocalizationKeys.travelPointsRedeem.tr(context),
                              style: const TextStyle(
                                fontSize: 13.0,
                                color: Colors.black54,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const Spacer(),
                    Container(
                      width: 79.0,
                      height: 79.0,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.transparent,
                      ),
                      child: ClipOval(
                        child: Image.asset(
                          AssetsImagesAppTravel.travelVipBadge,
                          width: 79.0,
                          height: 79.0,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              width: 79.0,
                              height: 79.0,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.3),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.verified,
                                size: 40.0,
                                color: Colors.white,
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildStats() {
    final statsData = _getStatsData(context);
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 20.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: statsData.map((stat) {
          return GestureDetector(
            onTap: () {
              debugPrint('${stat['label']} tapped');
            },
            child: Column(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Row(
                      children: [
                        Icon(
                          stat['icon'],
                          size: 20.0,
                          color: Colors.black54,
                        ),
                        const SizedBox(width: 4.0),
                        Text(
                          stat['label'],
                          style: const TextStyle(
                            fontSize: 14.0,
                            color: Colors.black54,
                          ),
                        ),
                        const SizedBox(width: 4.0),
                        Text(
                          '${stat['value']}',
                          style: const TextStyle(
                            fontSize: 16.0,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                      ],
                    ),
                    if (stat['hasBadge'])
                      Positioned(
                        top: -4.0,
                        right: -4.0,
                        child: Container(
                          width: 8.0,
                          height: 8.0,
                          decoration: const BoxDecoration(
                            color: TravelColors.travelBadge,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildOrderActions() {
    final orderActions = _getOrderActions(context);
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 20.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: orderActions.map((action) {
          final isHighlight = action['isHighlight'] ?? false;
          return GestureDetector(
            onTap: () {
              debugPrint('${action['label']} tapped');
            },
            child: Column(
              children: [
                Icon(
                  action['icon'],
                  size: 28.0,
                  color: isHighlight ? TravelColors.travelPrimary : Colors.black54,
                ),
                const SizedBox(height: 6.0),
                Text(
                  action['label'],
                  style: TextStyle(
                    fontSize: 12.0,
                    color: isHighlight ? TravelColors.travelPrimary : Colors.black54,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _build12306Prompt() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.train,
            size: 20.0,
            color: TravelColors.travelPrimary,
          ),
          const SizedBox(width: 8.0),
          Expanded(
            child: Text(
              TravelLocalizationKeys.travel12306Prompt.tr(context),
              style: const TextStyle(
                fontSize: 13.0,
                color: Colors.black87,
              ),
            ),
          ),
          GestureDetector(
            onTap: () {
              debugPrint('12306 prompt tapped');
            },
            child: Row(
              children: [
                Text(
                  TravelLocalizationKeys.travelGoCheck.tr(context),
                  style: const TextStyle(
                    fontSize: 13.0,
                    color: TravelColors.travelPrimary,
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  size: 18.0,
                  color: TravelColors.travelPrimary,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFinancialServices() {
    final financialServices = _getFinancialServices(context);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ...financialServices.map((service) {
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      debugPrint('${service['title']} tapped');
                    },
                    child: Column(
                      children: [
                        Text(
                          service['amount'],
                          style: const TextStyle(
                            fontSize: 18.0,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4.0),
                        Text(
                          service['title'],
                          style: const TextStyle(
                            fontSize: 13.0,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 2.0),
                        Text(
                          service['subtitle'],
                          style: const TextStyle(
                            fontSize: 11.0,
                            color: Colors.black45,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
              SizedBox(
                width: 60.0,
                child: Column(
                  children: [
                    Container(
                      width: 40.0,
                      height: 40.0,
                      decoration: BoxDecoration(
                        color: TravelColors.travelPrimaryLight,
                        borderRadius: BorderRadius.circular(8.0),
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet,
                        size: 24.0,
                        color: TravelColors.travelPrimary,
                      ),
                    ),
                    const SizedBox(height: 4.0),
                    Text(
                      TravelLocalizationKeys.travelMyWallet.tr(context),
                      style: const TextStyle(
                        fontSize: 11.0,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12.0),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
            decoration: BoxDecoration(
              color: TravelColors.travelAccentOrange,
              borderRadius: BorderRadius.circular(15.0),
            ),
            child: Text(
              TravelLocalizationKeys.travelGoCheck.tr(context),
              style: const TextStyle(
                fontSize: 13.0,
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFunctionGrid() {
    final functionGrid = _getFunctionGrid(context);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 5,
          crossAxisSpacing: 8.0,
          mainAxisSpacing: 20.0,
          childAspectRatio: 0.9,
        ),
        itemCount: functionGrid.length,
        itemBuilder: (context, index) {
          final function = functionGrid[index];
          return GestureDetector(
            onTap: () {
              debugPrint('${function['label']} tapped');
            },
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  function['icon'],
                  size: 28.0,
                  color: Colors.black54,
                ),
                const SizedBox(height: 6.0),
                Text(
                  function['label'],
                  style: const TextStyle(
                    fontSize: 11.0,
                    color: Colors.black54,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildRecommendation() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.circle,
                  size: 8.0,
                  color: TravelColors.travelPrimary,
                ),
                const SizedBox(width: 8.0),
                Text(
                  TravelLocalizationKeys.travelWonderfulRecommendation.tr(context),
                  style: const TextStyle(
                    fontSize: 16.0,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(width: 8.0),
                const Icon(
                  Icons.circle,
                  size: 8.0,
                  color: TravelColors.travelPrimary,
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(8.0),
              bottomRight: Radius.circular(8.0),
            ),
            child: Image.asset(
              'assets/apps/app_travel/images/profile_recommendation_banner.png',
              width: double.infinity,
              height: 200.0,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  width: double.infinity,
                  height: 200.0,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: TravelColors.travelGradientPurple,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      TravelLocalizationKeys.travelWonderful.tr(context),
                      style: const TextStyle(
                        fontSize: 24.0,
                        fontWeight: FontWeight.bold,
                        color: TravelColors.travelTextLight,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDefaultAvatar() {
    return Container(
      color: TravelColors.travelPrimaryLight,
      child: const Icon(
        Icons.person,
        size: 36.0,
        color: TravelColors.travelPrimary,
      ),
    );
  }
}
