import 'package:flutter/foundation.dart';
import '../models_app_travel/traveler_model.dart';

/// 出行人信息全局Provider
class TravelerProviderAppTravel extends ChangeNotifier {
  List<TravelerModel> _travelers = [];

  TravelerProviderAppTravel() {
    _initializeDefaultTraveler();
  }

  /// 初始化默认出行人
  void _initializeDefaultTraveler() {
    _travelers = [
      TravelerModel(
        id: 'default_1',
        name: 'XIONG YIN CAN',
        phone: '18984121454',
        email: 'cy00000000x@gmail.com',
        isDefault: true,
      ),
    ];
  }

  /// 获取所有出行人
  List<TravelerModel> get travelers => List.unmodifiable(_travelers);

  /// 获取默认出行人
  TravelerModel? get defaultTraveler {
    try {
      return _travelers.firstWhere((t) => t.isDefault);
    } catch (e) {
      return _travelers.isNotEmpty ? _travelers.first : null;
    }
  }

  /// 根据ID获取出行人
  TravelerModel? getTravelerById(String id) {
    try {
      return _travelers.firstWhere((t) => t.id == id);
    } catch (e) {
      return null;
    }
  }

  /// 添加出行人
  void addTraveler(TravelerModel traveler) {
    _travelers.add(traveler);
    notifyListeners();
  }

  /// 更新出行人
  void updateTraveler(TravelerModel traveler) {
    final index = _travelers.indexWhere((t) => t.id == traveler.id);
    if (index != -1) {
      _travelers[index] = traveler;
      notifyListeners();
    }
  }

  /// 删除出行人
  void deleteTraveler(String id) {
    _travelers.removeWhere((t) => t.id == id);
    notifyListeners();
  }

  /// 设置默认出行人
  void setDefaultTraveler(String id) {
    _travelers = _travelers.map((t) {
      return t.copyWith(isDefault: t.id == id);
    }).toList();
    notifyListeners();
  }

  /// 清空所有出行人（除了默认的）
  void clearTravelers() {
    _initializeDefaultTraveler();
    notifyListeners();
  }
}
