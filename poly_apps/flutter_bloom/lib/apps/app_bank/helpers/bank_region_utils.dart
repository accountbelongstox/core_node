// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
