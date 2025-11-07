import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/booking_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_auth_api_service.dart';

class VipClubBookingRepository {
  final VipClubAuthApiService _authApi;

  VipClubBookingRepository(this._authApi);

  Future<Map<String, dynamic>> createBooking({
    required String facilityType,
    required String facilityId,
    required DateTime bookingDate,
    required String timeSlot,
    required int duration,
    Map<String, dynamic>? extras,
  }) async {
    final result = await _authApi.postRequest('bookings', {
      'facility_type': facilityType,
      'facility_id': facilityId,
      'booking_date': bookingDate.toIso8601String(),
      'time_slot': timeSlot,
      'duration': duration,
      'extras': extras,
    });

    if (result['success']) {
      final booking = VipClubBookingModel.fromJson(
        result['data'] as Map<String, dynamic>,
      );
      return {
        'success': true,
        'booking': booking,
      };
    }

    return result;
  }

  Future<Map<String, dynamic>> getMyBookings({
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    var endpoint = 'bookings/my?page=$page&limit=$limit';
    if (status != null) {
      endpoint += '&status=$status';
    }

    final result = await _authApi.getRequest(endpoint);

    if (result['success']) {
      final data = result['data'] as Map<String, dynamic>;
      final bookingList = (data['bookings'] as List<dynamic>)
          .map((e) =>
              VipClubBookingModel.fromJson(e as Map<String, dynamic>))
          .toList();

      return {
        'success': true,
        'bookings': bookingList,
        'total': data['total'],
        'page': data['page'],
      };
    }

    return result;
  }

  Future<Map<String, dynamic>> getBookingDetails(String bookingId) async {
    final result = await _authApi.getRequest('bookings/$bookingId');

    if (result['success']) {
      final booking = VipClubBookingModel.fromJson(
        result['data'] as Map<String, dynamic>,
      );
      return {
        'success': true,
        'booking': booking,
      };
    }

    return result;
  }

  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    return await _authApi.putRequest('bookings/$bookingId/cancel', {});
  }

  Future<Map<String, dynamic>> updateBooking({
    required String bookingId,
    DateTime? newDate,
    String? newTimeSlot,
    int? newDuration,
  }) async {
    final data = <String, dynamic>{};

    if (newDate != null) {
      data['booking_date'] = newDate.toIso8601String();
    }
    if (newTimeSlot != null) {
      data['time_slot'] = newTimeSlot;
    }
    if (newDuration != null) {
      data['duration'] = newDuration;
    }

    return await _authApi.putRequest('bookings/$bookingId', data);
  }

  Future<Map<String, dynamic>> checkAvailability({
    required String facilityId,
    required DateTime date,
    required String timeSlot,
  }) async {
    return await _authApi.getRequest(
      'bookings/availability?facility_id=$facilityId&date=${date.toIso8601String()}&time_slot=$timeSlot',
    );
  }
}
