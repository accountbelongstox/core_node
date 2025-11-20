import 'package:flutter/foundation.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/banner_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/article_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/price_tier_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';

class VipClubAppDataProvider extends ChangeNotifier {
  List<VipClubBannerModel> _banners = [];
  List<VipClubArticleModel> _articles = [];
  List<VipClubPriceTierModel> _priceTiers = [];
  List<VipClubFacilityModel> _facilities = [];

  bool _isLoading = false;
  String? _errorMessage;

  List<VipClubBannerModel> get banners => _banners;
  List<VipClubArticleModel> get articles => _articles;
  List<VipClubPriceTierModel> get priceTiers => _priceTiers;
  List<VipClubFacilityModel> get facilities => _facilities;

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  List<VipClubArticleModel> get featuredArticles {
    return _articles.where((article) => article.isFeatured).toList();
  }

  List<VipClubPriceTierModel> getPriceTiersByCategory(String category) {
    return _priceTiers.where((tier) => tier.category == category).toList()
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  List<String> get priceCategories {
    final categories = _priceTiers.map((tier) => tier.category).toSet().toList();
    return categories;
  }

  void setBanners(List<VipClubBannerModel> banners) {
    _banners = banners..sort((a, b) => a.order.compareTo(b.order));
    notifyListeners();
  }

  void setArticles(List<VipClubArticleModel> articles) {
    _articles = articles;
    notifyListeners();
  }

  void setPriceTiers(List<VipClubPriceTierModel> priceTiers) {
    _priceTiers = priceTiers;
    notifyListeners();
  }

  void setFacilities(List<VipClubFacilityModel> facilities) {
    _facilities = facilities;
    notifyListeners();
  }

  void setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void setError(String? error) {
    _errorMessage = error;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> loadMockData() async {
    setLoading(true);
    clearError();

    try {
      await Future.delayed(const Duration(milliseconds: 500));

      _banners = [
        VipClubBannerModel(
          id: '1',
          imageUrl: 'https://picsum.photos/800/400?random=1',
          title: 'Welcome to Elite VIP Club',
          subtitle: 'Exclusive benefits await you',
          order: 1,
        ),
        VipClubBannerModel(
          id: '2',
          imageUrl: 'https://picsum.photos/800/400?random=2',
          title: 'Premium Golf Experience',
          subtitle: 'Book your tee time now',
          order: 2,
        ),
        VipClubBannerModel(
          id: '3',
          imageUrl: 'https://picsum.photos/800/400?random=3',
          title: 'Luxury Hotel Stays',
          subtitle: 'Special member discounts',
          order: 3,
        ),
      ];

      _priceTiers = [
        VipClubPriceTierModel(
          id: '1',
          name: 'Standard',
          category: 'membership',
          price: 0,
          duration: 'month',
          features: ['Basic Access', 'Member Events'],
          order: 1,
        ),
        VipClubPriceTierModel(
          id: '2',
          name: 'Gold',
          category: 'membership',
          price: 99,
          duration: 'month',
          features: ['Priority Booking', '10% Discount', 'Exclusive Events'],
          isPopular: true,
          order: 2,
        ),
        VipClubPriceTierModel(
          id: '3',
          name: 'Platinum',
          category: 'membership',
          price: 199,
          duration: 'month',
          features: ['VIP Lounge Access', '20% Discount', 'Personal Concierge'],
          order: 3,
        ),
        VipClubPriceTierModel(
          id: '4',
          name: 'Diamond',
          category: 'membership',
          price: 499,
          duration: 'month',
          features: [
            'All Platinum Benefits',
            '30% Discount',
            'Priority Support',
            'Exclusive Retreats'
          ],
          order: 4,
        ),
      ];

      notifyListeners();
    } catch (e) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }
}
