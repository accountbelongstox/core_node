class BankRegionUtils {
  BankRegionUtils._();

  static String? pickSmallestRegion({
    required String? province,
    required String? city,
    required String? district,
  }) {
    final districtText = _normalizeNullable(district);
    if (districtText != null) return districtText;

    final cityText = _normalizeNullable(city);
    if (cityText != null) return cityText;

    return _normalizeNullable(province);
  }

  static String stripAdminSuffixForDisplay(String input) {
    var value = input.trim();
    if (value.isEmpty) return value;

    const suffixes = <String>[
      '特别行政区',
      '自治区',
      '省',
      '市',
      '地区',
      '盟',
      '县',
      '区',
    ];

    for (final s in suffixes) {
      if (value.endsWith(s) && value.length > s.length) {
        value = value.substring(0, value.length - s.length);
        break;
      }
    }
    return value;
  }

  static String? _normalizeNullable(String? input) {
    final v = input?.trim();
    if (v == null || v.isEmpty) return null;
    return v;
  }
}
