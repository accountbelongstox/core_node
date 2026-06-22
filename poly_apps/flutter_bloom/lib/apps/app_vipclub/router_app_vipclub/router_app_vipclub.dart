import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/views/splash_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/views/login_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/home/views/home_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/profile/views/profile_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/splash/views/splash_intro_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/membership/views/membership_tiers_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/articles/views/articles_list_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/articles/views/article_detail_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/support/views/customer_service_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/payments/views/payment_screen.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/payments/views/payment_history_screen.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/article_model_app_vipclub.dart';

class VipClubRoutes {
  static const String splash = '/';
  static const String splashIntro = '/splash-intro';
  static const String login = '/login';
  static const String register = '/register';
  static const String home = '/home';
  static const String facilities = '/facilities';
  static const String shooting = '/shooting';
  static const String shootingDetails = '/shooting/:id';
  static const String golf = '/golf';
  static const String golfDetails = '/golf/:id';
  static const String hotel = '/hotel';
  static const String hotelDetails = '/hotel/:id';
  static const String bookings = '/bookings';
  static const String bookingDetails = '/bookings/:id';
  static const String createBooking = '/create-booking';
  static const String profile = '/profile';
  static const String vipZone = '/vip-zone';
  static const String vipCard = '/vip-card';
  static const String vipBenefits = '/vip-benefits';
  static const String membershipTiers = '/membership/tiers';
  static const String membershipSubscribe = '/membership/subscribe';
  static const String articles = '/articles';
  static const String articleDetail = '/articles/detail';
  static const String customerService = '/support';
  static const String payment = '/payments/pay';
  static const String paymentHistory = '/payments/history';
  static const String settings = '/settings';
}

GoRouter createVipClubRouter() {
  return GoRouter(
    initialLocation: VipClubRoutes.splash,
    routes: [
      GoRoute(
        path: VipClubRoutes.splash,
        builder: (context, state) => const VipClubSplashScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.splashIntro,
        builder: (context, state) => const VipClubSplashIntroScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.login,
        builder: (context, state) => const VipClubLoginScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.register,
        builder: (context, state) => const VipClubRegisterScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.home,
        builder: (context, state) => const VipClubHomeScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.facilities,
        builder: (context, state) => const VipClubFacilitiesScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.shooting,
        builder: (context, state) => const VipClubShootingScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.shootingDetails,
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return VipClubShootingDetailsScreen(facilityId: id);
        },
      ),
      GoRoute(
        path: VipClubRoutes.golf,
        builder: (context, state) => const VipClubGolfScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.golfDetails,
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return VipClubGolfDetailsScreen(facilityId: id);
        },
      ),
      GoRoute(
        path: VipClubRoutes.hotel,
        builder: (context, state) => const VipClubHotelScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.hotelDetails,
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return VipClubHotelDetailsScreen(roomId: id);
        },
      ),
      GoRoute(
        path: VipClubRoutes.bookings,
        builder: (context, state) => const VipClubBookingsScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.bookingDetails,
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return VipClubBookingDetailsScreen(bookingId: id);
        },
      ),
      GoRoute(
        path: VipClubRoutes.createBooking,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return VipClubCreateBookingScreen(facilityData: extra);
        },
      ),
      GoRoute(
        path: VipClubRoutes.profile,
        builder: (context, state) => const VipClubProfileScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.vipZone,
        builder: (context, state) => const VipClubVipZoneScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.vipCard,
        builder: (context, state) => const VipClubVipCardScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.vipBenefits,
        builder: (context, state) => const VipClubVipBenefitsScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.settings,
        builder: (context, state) => const VipClubSettingsScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.membershipTiers,
        builder: (context, state) => const VipClubMembershipTiersScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.membershipSubscribe,
        builder: (context, state) {
          final tier = state.extra as Map<String, dynamic>;
          return VipClubMembershipSubscribeScreen(tier: tier);
        },
      ),
      GoRoute(
        path: VipClubRoutes.articles,
        builder: (context, state) => const VipClubArticlesListScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.articleDetail,
        builder: (context, state) {
          final article = state.extra as VipClubArticleModel;
          return VipClubArticleDetailScreen(article: article);
        },
      ),
      GoRoute(
        path: VipClubRoutes.customerService,
        builder: (context, state) => const VipClubCustomerServiceScreen(),
      ),
      GoRoute(
        path: VipClubRoutes.payment,
        builder: (context, state) {
          final args = state.extra as Map<String, dynamic>;
          return VipClubPaymentScreen(
            bookingId: args['bookingId'],
            membershipTier: args['membershipTier'],
            amount: args['amount'],
            title: args['title'],
            description: args['description'] ?? '',
          );
        },
      ),
      GoRoute(
        path: VipClubRoutes.paymentHistory,
        builder: (context, state) => const VipClubPaymentHistoryScreen(),
      ),
    ],
  );
}

class VipClubRegisterScreen extends StatelessWidget {
  const VipClubRegisterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club Register Screen'),
      ),
    );
  }
}

class VipClubFacilitiesScreen extends StatelessWidget {
  const VipClubFacilitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club Facilities Screen'),
      ),
    );
  }
}

class VipClubShootingScreen extends StatelessWidget {
  const VipClubShootingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club Shooting Screen'),
      ),
    );
  }
}

class VipClubShootingDetailsScreen extends StatelessWidget {
  final String facilityId;

  const VipClubShootingDetailsScreen({
    super.key,
    required this.facilityId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text('VIP Club Shooting Details: $facilityId'),
      ),
    );
  }
}

class VipClubGolfScreen extends StatelessWidget {
  const VipClubGolfScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club Golf Screen'),
      ),
    );
  }
}

class VipClubGolfDetailsScreen extends StatelessWidget {
  final String facilityId;

  const VipClubGolfDetailsScreen({
    super.key,
    required this.facilityId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text('VIP Club Golf Details: $facilityId'),
      ),
    );
  }
}

class VipClubHotelScreen extends StatelessWidget {
  const VipClubHotelScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club Hotel Screen'),
      ),
    );
  }
}

class VipClubHotelDetailsScreen extends StatelessWidget {
  final String roomId;

  const VipClubHotelDetailsScreen({
    super.key,
    required this.roomId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text('VIP Club Hotel Details: $roomId'),
      ),
    );
  }
}

class VipClubBookingsScreen extends StatelessWidget {
  const VipClubBookingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club Bookings Screen'),
      ),
    );
  }
}

class VipClubBookingDetailsScreen extends StatelessWidget {
  final String bookingId;

  const VipClubBookingDetailsScreen({
    super.key,
    required this.bookingId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text('VIP Club Booking Details: $bookingId'),
      ),
    );
  }
}

class VipClubCreateBookingScreen extends StatelessWidget {
  final Map<String, dynamic>? facilityData;

  const VipClubCreateBookingScreen({
    super.key,
    this.facilityData,
  });

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club Create Booking Screen'),
      ),
    );
  }
}

class VipClubVipZoneScreen extends StatelessWidget {
  const VipClubVipZoneScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club VIP Zone Screen'),
      ),
    );
  }
}

class VipClubVipCardScreen extends StatelessWidget {
  const VipClubVipCardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club VIP Card Screen'),
      ),
    );
  }
}

class VipClubVipBenefitsScreen extends StatelessWidget {
  const VipClubVipBenefitsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club VIP Benefits Screen'),
      ),
    );
  }
}

class VipClubSettingsScreen extends StatelessWidget {
  const VipClubSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('VIP Club Settings Screen'),
      ),
    );
  }
}
