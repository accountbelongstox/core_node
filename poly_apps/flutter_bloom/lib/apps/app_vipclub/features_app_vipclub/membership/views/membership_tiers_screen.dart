import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/widgets.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_gradients.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/membership_api_service_app_vipclub.dart';

/// VIP Membership Tiers Selection Screen
class VipClubMembershipTiersScreen extends StatefulWidget {
  const VipClubMembershipTiersScreen({super.key});

  @override
  State<VipClubMembershipTiersScreen> createState() =>
      _VipClubMembershipTiersScreenState();
}

class _VipClubMembershipTiersScreenState
    extends State<VipClubMembershipTiersScreen> {
  final _membershipService = VipClubMembershipApiService();

  List<Map<String, dynamic>> _tiers = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTiers();
  }

  Future<void> _loadTiers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final tiers = await _membershipService.getMembershipTiers();
      setState(() {
        _tiers = tiers;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _handleSelectTier(Map<String, dynamic> tier) {
    Navigator.pushNamed(
      context,
      '/membership/subscribe',
      arguments: tier,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.neutralWhite,
      appBar: AppBar(
        title: Text('VIP Membership'),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return LoadingState(message: 'Loading membership options...');
    }

    if (_error != null) {
      return ErrorState(
        title: 'Failed to Load',
        message: _error!,
        onRetry: _loadTiers,
      );
    }

    if (_tiers.isEmpty) {
      return EmptyState(
        title: 'No Plans Available',
        message: 'Please check back later',
        icon: Icons.card_membership,
      );
    }

    return SingleChildScrollView(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Text(
            'Choose Your VIP Membership',
            style: ThemeTextStyles.headlineLarge.copyWith(
              fontWeight: FontWeight.bold,
              color: ThemeColors.primaryBlue,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            'Unlock exclusive benefits and privileges',
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.hugePadding),

          // Membership Tiers
          ..._tiers.map((tier) => _buildTierCard(tier)),
        ],
      ),
    );
  }

  Widget _buildTierCard(Map<String, dynamic> tier) {
    final name = tier['name'] ?? '';
    final price = tier['price'] ?? 0.0;
    final period = tier['period'] ?? 'month';
    final features = List<String>.from(tier['features'] ?? []);
    final isPopular = tier['is_popular'] ?? false;
    final discount = tier['discount'] ?? 0;

    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.defaultPadding),
      child: VipTierCard(
        tier: name.toLowerCase(),
        title: '$name Membership',
        subtitle: 'Unlock exclusive VIP privileges',
        price: '\$${price.toStringAsFixed(2)}/$period',
        features: features,
        onTap: () => _handleSelectTier(tier),
        isSelected: isPopular,
        badge: discount > 0
            ? GradientBadge(
                text: '$discount% OFF',
                gradient: const LinearGradient(
                  colors: [Color(0xFFFF6B6B), Color(0xFFFFE66D)],
                ),
                icon: Icons.local_offer,
              )
            : isPopular
                ? const VipBadge(
                    tier: 'POPULAR',
                    icon: Icons.star,
                  )
                : null,
      ),
    );
  }
}

/// VIP Membership Subscribe Screen
class VipClubMembershipSubscribeScreen extends StatefulWidget {
  final Map<String, dynamic> tier;

  const VipClubMembershipSubscribeScreen({
    super.key,
    required this.tier,
  });

  @override
  State<VipClubMembershipSubscribeScreen> createState() =>
      _VipClubMembershipSubscribeScreenState();
}

class _VipClubMembershipSubscribeScreenState
    extends State<VipClubMembershipSubscribeScreen> {
  final _membershipService = VipClubMembershipApiService();

  String _selectedPaymentMethod = 'stripe';
  bool _isProcessing = false;

  final List<Map<String, dynamic>> _paymentMethods = [
    {
      'id': 'stripe',
      'name': 'Credit Card',
      'icon': Icons.credit_card,
    },
    {
      'id': 'paypal',
      'name': 'PayPal',
      'icon': Icons.account_balance_wallet,
    },
    {
      'id': 'wechat',
      'name': 'WeChat Pay',
      'icon': Icons.chat,
    },
    {
      'id': 'alipay',
      'name': 'Alipay',
      'icon': Icons.payment,
    },
  ];

  Future<void> _handleSubscribe() async {
    setState(() => _isProcessing = true);

    try {
      // In real app, integrate with payment gateway to get payment token
      final paymentToken = 'mock_payment_token_${DateTime.now().millisecondsSinceEpoch}';

      final result = await _membershipService.subscribe(
        tier: widget.tier['id'] ?? widget.tier['name']?.toString().toLowerCase() ?? '',
        paymentMethod: _selectedPaymentMethod,
        paymentToken: paymentToken,
      );

      if (result['success'] && mounted) {
        showSuccessDialog(
          context: context,
          title: 'Subscription Successful!',
          message:
              'Welcome to ${widget.tier['name']} VIP! Enjoy your exclusive benefits.',
          onPressed: () {
            Navigator.popUntil(context, (route) => route.isFirst);
            Navigator.pushReplacementNamed(context, '/vip-card');
          },
        );
      }
    } catch (e) {
      if (mounted) {
        showErrorDialog(
          context: context,
          title: 'Subscription Failed',
          message: e.toString(),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.neutralWhite,
      appBar: AppBar(
        title: Text('Subscribe'),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Tier Summary
            PremiumGradientCard(
              gradient: ThemeGradients.getVipTierGradient(
                widget.tier['name']?.toString().toLowerCase() ?? 'gold',
              ),
              elevated: true,
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      VipBadge(
                        tier: widget.tier['name']?.toString().toUpperCase() ?? 'VIP',
                        icon: Icons.workspace_premium,
                      ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    '${widget.tier['name']} Membership',
                    style: ThemeTextStyles.headlineMedium.copyWith(
                      color: ThemeColors.neutralWhite,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.smallPadding),
                  Text(
                    '\$${widget.tier['price']}/${widget.tier['period']}',
                    style: ThemeTextStyles.displaySmall.copyWith(
                      color: ThemeColors.neutralWhite,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: ThemeDimensions.largePadding),

            // Payment Method Selection
            ListSectionHeader(title: 'Select Payment Method'),
            SizedBox(height: ThemeDimensions.defaultPadding),

            ..._paymentMethods.map((method) {
              final isSelected = _selectedPaymentMethod == method['id'];
              return Padding(
                padding: EdgeInsets.only(bottom: ThemeDimensions.smallPadding),
                child: StyledListTile(
                  leading: Icon(
                    method['icon'],
                    color: isSelected
                        ? ThemeColors.primaryBlue
                        : ThemeColors.neutralGrey,
                  ),
                  title: method['name'],
                  trailing: isSelected
                      ? Icon(Icons.check_circle, color: ThemeColors.primaryBlue)
                      : null,
                  onTap: () {
                    setState(() => _selectedPaymentMethod = method['id']);
                  },
                  backgroundColor: isSelected
                      ? ThemeColors.primaryBlue.withOpacity(0.1)
                      : null,
                ),
              );
            }),

            SizedBox(height: ThemeDimensions.hugePadding),

            // Subscribe Button
            VipTierButton(
              text: 'Subscribe to ${widget.tier['name']} VIP',
              tier: widget.tier['name']?.toString().toLowerCase() ?? 'gold',
              onPressed: _handleSubscribe,
              isLoading: _isProcessing,
              isFullWidth: true,
              icon: Icons.workspace_premium,
            ),

            SizedBox(height: ThemeDimensions.defaultPadding),

            // Terms
            Text(
              'By subscribing, you agree to our Terms of Service and Privacy Policy. Your subscription will auto-renew unless cancelled.',
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.neutralGrey,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
