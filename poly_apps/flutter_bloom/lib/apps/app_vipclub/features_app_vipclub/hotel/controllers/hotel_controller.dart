import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_public_api_service.dart';

class VipClubHotelController extends ChangeNotifier {
  final VipClubPublicApiService _publicApi;

  bool _isLoading = false;
  String? _errorMessage;
  List<VipClubHotelRoomModel> _hotelRooms = [];
  VipClubHotelRoomModel? _selectedRoom;
  bool _isRoomAvailable = false;

  VipClubHotelController(this._publicApi);

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<VipClubHotelRoomModel> get hotelRooms => _hotelRooms;
  VipClubHotelRoomModel? get selectedRoom => _selectedRoom;
  bool get isRoomAvailable => _isRoomAvailable;

  Future<void> loadHotelRooms() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final facilities = await _publicApi.getFacilities(type: 'hotel');
      _hotelRooms = facilities
          .where((f) => f is VipClubHotelRoomModel)
          .cast<VipClubHotelRoomModel>()
          .toList();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load hotel rooms: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadHotelRoomDetails(String id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final facility = await _publicApi.getFacilityById(id);
      if (facility is VipClubHotelRoomModel) {
        _selectedRoom = facility;
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load room details: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> checkRoomAvailability(
    String facilityId,
    DateTime checkIn,
    DateTime checkOut,
  ) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _publicApi.checkAvailability(
        facilityId: facilityId,
        date: checkIn,
        timeSlot: '${checkOut.year}-${checkOut.month.toString().padLeft(2, '0')}-${checkOut.day.toString().padLeft(2, '0')}',
      );
      _isRoomAvailable = response;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to check availability: ${e.toString()}';
      _isRoomAvailable = false;
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void clearSelection() {
    _selectedRoom = null;
    _isRoomAvailable = false;
    notifyListeners();
  }
}
