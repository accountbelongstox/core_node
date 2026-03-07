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

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../utils/china_regions.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../helpers/bank_region_utils.dart';

class RegionSelectorWidget extends StatefulWidget {
  final String? initialProvince;
  final String? initialCity;
  final String? initialCounty;
  final ValueChanged<RegionSelectionResult>? onRegionChanged;
  final bool showCustomRegionOption;
  final bool showLocationButton;
  final VoidCallback? onLocationRequested;

  const RegionSelectorWidget({
    super.key,
    this.initialProvince,
    this.initialCity,
    this.initialCounty,
    this.onRegionChanged,
    this.showCustomRegionOption = true,
    this.showLocationButton = false,
    this.onLocationRequested,
  });

  @override
  State<RegionSelectorWidget> createState() => RegionSelectorWidgetState();
}

class RegionSelectorWidgetState extends State<RegionSelectorWidget> {
  String? _selectedProvince;
  String? _selectedCity;
  String? _selectedCounty;
  bool _useCustomRegion = false;
  final List<String> _filteredProvinces = [];
  final List<String> _filteredCities = [];
  final List<String> _filteredCounties = [];
  String _searchQuery = '';
  bool _showRegionSelector = false;
  final TextEditingController _customRegionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedProvince = widget.initialProvince;
    _selectedCity = widget.initialCity;
    _selectedCounty = widget.initialCounty;
    _customRegionController.text = _selectedCity ?? _selectedProvince ?? '';
    _filteredProvinces.addAll(ChinaRegions.provinces);
    if (_selectedProvince != null) {
      _filteredCities.addAll(ChinaRegions.getCities(_selectedProvince!));
      if (_selectedCity != null) {
        _filteredCounties.addAll(
            ChinaRegions.getCounties(_selectedProvince!, _selectedCity!));
      }
    }
  }

  @override
  void dispose() {
    _customRegionController.dispose();
    super.dispose();
  }

  void _selectProvince(String province) {
    setState(() {
      _selectedProvince = province;
      _selectedCity = null;
      _selectedCounty = null;
      _filteredCities.clear();
      _filteredCities.addAll(ChinaRegions.getCities(province));
      _filteredCounties.clear();
      _notifyRegionChanged();
    });
  }

  void _selectCity(String city) {
    setState(() {
      _selectedCity = city;
      _selectedCounty = null;
      _filteredCounties.clear();
      _filteredCounties
          .addAll(ChinaRegions.getCounties(_selectedProvince!, city));
      _notifyRegionChanged();
    });
  }

  void _selectCounty(String county) {
    setState(() {
      _selectedCounty = county;
      _notifyRegionChanged();
    });
  }

  void _notifyRegionChanged() {
    if (widget.onRegionChanged != null) {
      widget.onRegionChanged!(RegionSelectionResult(
        province: _selectedProvince,
        city: _selectedCity,
        county: _selectedCounty,
        customRegion:
            _useCustomRegion ? _customRegionController.text.trim() : null,
      ));
    }
  }

  void _updateRegionFromLocation(String? province, String? city) {
    if (province != null && province.isNotEmpty) {
      final matchedProvince = ChinaRegions.provinces.firstWhere(
        (p) =>
            p.contains(province) ||
            province.contains(p
                .replaceAll('省', '')
                .replaceAll('市', '')
                .replaceAll('自治区', '')
                .replaceAll('特别行政区', '')
                .replaceAll('维吾尔', '')
                .replaceAll('回族', '')
                .replaceAll('壮族', '')
                .trim()),
        orElse: () => province,
      );

      setState(() {
        _selectedProvince = matchedProvince;
        _selectedCity = null;
        _selectedCounty = null;
        _filteredCities.clear();
        _filteredCities.addAll(ChinaRegions.getCities(matchedProvince));
        _filteredCounties.clear();
      });

      if (city != null && city.isNotEmpty) {
        final cities = ChinaRegions.getCities(matchedProvince);
        final matchedCity = cities.firstWhere(
          (c) =>
              c.contains(city.replaceAll('市', '').trim()) ||
              city.contains(c.replaceAll('市', '').trim()),
          orElse: () => city,
        );

        if (cities.contains(matchedCity)) {
          setState(() {
            _selectedCity = matchedCity;
            _selectedCounty = null;
            _filteredCounties.clear();
            _filteredCounties
                .addAll(ChinaRegions.getCounties(matchedProvince, matchedCity));
          });
        }
      }

      _notifyRegionChanged();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.showLocationButton)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: widget.onLocationRequested,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF74B9FF),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(BankConstants.borderRadius),
                  ),
                ),
                icon: const Icon(Icons.my_location, size: 20),
                label: const Text('一键定位'),
              ),
            ),
          ),
        if (widget.showCustomRegionOption) ...[
          Row(
            children: [
              const Text(
                '自定义地区',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87,
                ),
              ),
              const Spacer(),
              Switch(
                value: _useCustomRegion,
                onChanged: (value) {
                  setState(() {
                    _useCustomRegion = value;
                    _showRegionSelector = !value;
                  });
                  _notifyRegionChanged();
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],
        if (_useCustomRegion)
          TextField(
            controller: _customRegionController,
            onChanged: (_) => _notifyRegionChanged(),
            decoration: InputDecoration(
              hintText: '请输入地区名称',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                borderSide: BorderSide(color: Colors.grey[300]!),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                borderSide: BorderSide(color: Colors.grey[300]!),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                borderSide:
                    const BorderSide(color: Color(0xFF74B9FF), width: 2),
              ),
              filled: true,
              fillColor: Colors.grey[50],
              prefixIcon:
                  const Icon(Icons.location_on, color: Color(0xFF74B9FF)),
            ),
          )
        else ...[
          Text(
            _selectedProvince != null
                ? '${_selectedProvince ?? ''} ${_selectedCity ?? ''} ${_selectedCounty ?? ''}'
                : '未选择地区',
            style: TextStyle(
              fontSize: 14,
              color:
                  _selectedProvince != null ? Colors.black87 : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () {
              setState(() {
                _showRegionSelector = !_showRegionSelector;
              });
            },
            child: Text(_showRegionSelector ? '收起地区选择' : '选择地区'),
          ),
          if (_showRegionSelector) ...[
            const SizedBox(height: 12),
            _buildRegionSelector(),
          ],
        ],
      ],
    );
  }

  Widget _buildRegionSelector() {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey[300]!),
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildProvinceList(),
          ),
          if (_selectedProvince != null)
            Expanded(
              child: _buildCityList(),
            ),
          if (_selectedCity != null && _filteredCounties.isNotEmpty)
            Expanded(
              child: _buildCountyList(),
            ),
        ],
      ),
    );
  }

  Widget _buildProvinceList() {
    final provinces = _searchQuery.isEmpty
        ? _filteredProvinces
        : _filteredProvinces.where((p) => p.contains(_searchQuery)).toList();

    return ListView.builder(
      itemCount: provinces.length,
      itemBuilder: (context, index) {
        final province = provinces[index];
        final isSelected = _selectedProvince == province;
        return ListTile(
          title: Text(province),
          selected: isSelected,
          selectedTileColor: const Color(0xFF74B9FF).withOpacity(0.1),
          onTap: () => _selectProvince(province),
          trailing: isSelected
              ? const Icon(Icons.check, color: Color(0xFF74B9FF), size: 20)
              : null,
        );
      },
    );
  }

  Widget _buildCityList() {
    final cities = _searchQuery.isEmpty
        ? _filteredCities
        : _filteredCities.where((c) => c.contains(_searchQuery)).toList();

    return Container(
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: Colors.grey[300]!),
        ),
      ),
      child: ListView.builder(
        itemCount: cities.length,
        itemBuilder: (context, index) {
          final city = cities[index];
          final isSelected = _selectedCity == city;
          return ListTile(
            title: Text(city),
            selected: isSelected,
            selectedTileColor: const Color(0xFF74B9FF).withOpacity(0.1),
            onTap: () => _selectCity(city),
            trailing: isSelected
                ? const Icon(Icons.check, color: Color(0xFF74B9FF), size: 20)
                : null,
          );
        },
      ),
    );
  }

  Widget _buildCountyList() {
    final counties = _searchQuery.isEmpty
        ? _filteredCounties
        : _filteredCounties.where((c) => c.contains(_searchQuery)).toList();

    return Container(
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: Colors.grey[300]!),
        ),
      ),
      child: ListView.builder(
        itemCount: counties.length,
        itemBuilder: (context, index) {
          final county = counties[index];
          final isSelected = _selectedCounty == county;
          return ListTile(
            title: Text(county),
            selected: isSelected,
            selectedTileColor: const Color(0xFF74B9FF).withOpacity(0.1),
            onTap: () => _selectCounty(county),
            trailing: isSelected
                ? const Icon(Icons.check, color: Color(0xFF74B9FF), size: 20)
                : null,
          );
        },
      ),
    );
  }

  void updateFromLocation(String? province, String? city) {
    _updateFromLocation(province: province, city: city, district: null);
  }

  void updateFromLocationInfo(
      String? province, String? city, String? district) {
    _updateFromLocation(province: province, city: city, district: district);
  }

  void _updateFromLocation({
    required String? province,
    required String? city,
    required String? district,
  }) {
    _updateRegionFromLocation(province, city);

    final smallest = BankRegionUtils.pickSmallestRegion(
      province: province,
      city: city,
      district: district,
    );
    if (smallest == null || smallest.isEmpty) return;

    setState(() {
      _useCustomRegion = true;
      _showRegionSelector = false;
      _customRegionController.text = smallest;
    });
    _notifyRegionChanged();
  }
}

class RegionSelectionResult {
  final String? province;
  final String? city;
  final String? county;
  final String? customRegion;

  RegionSelectionResult({
    this.province,
    this.city,
    this.county,
    this.customRegion,
  });

  String? get location => customRegion ?? province;
  String? get cityName => customRegion ?? county ?? city ?? province;
}
