library;

import '../domain/model/doantion_model.dart';

class DonationData {
  static List<DonationModel> getDonations() {
    return [
      DonationModel(
        title: 'Education Fund',
        image: null,
        donators: '1.2k',
        found: '¥50,000',
        days: '30',
      ),
      DonationModel(
        title: 'Rural Schools',
        image: null,
        donators: '890',
        found: '¥30,000',
        days: '15',
      ),
    ];
  }
}
