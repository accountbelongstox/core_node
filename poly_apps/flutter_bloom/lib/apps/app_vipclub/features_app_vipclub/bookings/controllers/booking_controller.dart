import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/booking_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/repositories_app_vipclub/booking_repository.dart';

class VipClubBookingController extends ChangeNotifier {
  final VipClubBookingRepository _bookingRepository;

  bool _isLoading = false;
  String? _errorMessage;
  List<VipClubBookingModel> _myBookings = [];
  VipClubBookingModel? _selectedBooking;
  int _totalBookings = 0;
  int _currentPage = 1;

  VipClubBookingController(this._bookingRepository);

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<VipClubBookingModel> get myBookings => _myBookings;
  VipClubBookingModel? get selectedBooking => _selectedBooking;
  int get totalBookings => _totalBookings;
  int get currentPage => _currentPage;

  Future<bool> createBooking({
    required String facilityType,
    required String facilityId,
    required DateTime bookingDate,
    required String timeSlot,
    required int duration,
    Map<String, dynamic>? extras,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _bookingRepository.createBooking(
        facilityType: facilityType,
        facilityId: facilityId,
        bookingDate: bookingDate,
        timeSlot: timeSlot,
        duration: duration,
        extras: extras,
      );

      _isLoading = false;
      notifyListeners();
      return result['success'] == true;
    } catch (e) {
      _errorMessage = 'Failed to create booking: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> loadMyBookings({
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _bookingRepository.getMyBookings(
        status: status,
        page: page,
        limit: limit,
      );

      _myBookings = result['bookings'] as List<VipClubBookingModel>;
      _totalBookings = result['total'] as int;
      _currentPage = result['page'] as int;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load bookings: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadBookingDetails(String bookingId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _bookingRepository.getBookingDetails(bookingId);
      if (result['success']) {
        _selectedBooking = result['booking'];
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load booking details: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> cancelBooking(String bookingId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _bookingRepository.cancelBooking(bookingId);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Failed to cancel booking: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateBooking({
    required String bookingId,
    DateTime? bookingDate,
    String? timeSlot,
    int? duration,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _bookingRepository.updateBooking(
        bookingId: bookingId,
        newDate: bookingDate,
        newTimeSlot: timeSlot,
        newDuration: duration,
      );
      _isLoading = false;
      notifyListeners();
      return result['success'] == true;
    } catch (e) {
      _errorMessage = 'Failed to update booking: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void clearSelection() {
    _selectedBooking = null;
    notifyListeners();
  }
}
