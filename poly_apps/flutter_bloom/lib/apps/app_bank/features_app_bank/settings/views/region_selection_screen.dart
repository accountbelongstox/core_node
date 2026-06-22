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
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../helpers/bank_region_utils.dart';
import '../utils/china_regions.dart';
import '../utils/location_helper.dart';

class RegionSelectionScreen extends StatefulWidget {
  const RegionSelectionScreen({super.key});

  @override
  State<RegionSelectionScreen> createState() => _RegionSelectionScreenState();
}

class _RegionSelectionScreenState extends State<RegionSelectionScreen> {
  final TextEditingController _customRegionController = TextEditingController();
  String? _selectedProvince;
  String? _selectedCity;
  String? _selectedCounty;
  bool _useCustomRegion = false;
  final List<String> _filteredProvinces = [];
  final List<String> _filteredCities = [];
  final List<String> _filteredCounties = [];
  String _searchQuery = '';
  bool _isLocating = false;

  @override
  void initState() {
    super.initState();
    _loadCurrentRegion();
    _filteredProvinces.addAll(ChinaRegions.provinces);
  }

  void _loadCurrentRegion() {
    final provider = Provider.of<BankUserProvider>(context, listen: false);
    _selectedProvince =
        provider.globalData?.location ?? provider.user?.location;
    _selectedCity = provider.globalData?.city ?? provider.user?.city;
    _customRegionController.text = _selectedCity ?? _selectedProvince ?? '';
  }

  void _filterRegions(String query) {
    setState(() {
      _searchQuery = query;
      if (query.isEmpty) {
        _filteredProvinces.clear();
        _filteredProvinces.addAll(ChinaRegions.provinces);
        _filteredCities.clear();
        _filteredCounties.clear();
      } else {
        _filteredProvinces.clear();
        _filteredProvinces.addAll(
          ChinaRegions.provinces.where((p) => p.contains(query)).toList(),
        );

        if (_selectedProvince != null) {
          final cities = ChinaRegions.getCities(_selectedProvince!);
          _filteredCities.clear();
          _filteredCities.addAll(
            cities.where((c) => c.contains(query)).toList(),
          );
        }

        if (_selectedCity != null) {
          final counties =
              ChinaRegions.getCounties(_selectedProvince!, _selectedCity!);
          _filteredCounties.clear();
          _filteredCounties.addAll(
            counties.where((c) => c.contains(query)).toList(),
          );
        }
      }
    });
  }

  void _selectProvince(String province) {
    setState(() {
      _selectedProvince = province;
      _selectedCity = null;
      _selectedCounty = null;
      _filteredCities.clear();
      _filteredCities.addAll(ChinaRegions.getCities(province));
      _filteredCounties.clear();
    });
  }

  void _selectCity(String city) {
    setState(() {
      _selectedCity = city;
      _selectedCounty = null;
      _filteredCounties.clear();
      _filteredCounties
          .addAll(ChinaRegions.getCounties(_selectedProvince!, city));
    });
  }

  void _selectCounty(String county) {
    setState(() {
      _selectedCounty = county;
    });
  }

  Future<void> _handleAutoLocation() async {
    setState(() {
      _isLocating = true;
    });

    try {
      final location = await _getCurrentLocation();
      if (location == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('无法获取当前位置，请检查定位权限'),
              duration: Duration(seconds: 2),
            ),
          );
        }
        return;
      }

      final locationResult = await LocationHelper.getLocationFromCoordinates(
        location['latitude'] as double,
        location['longitude'] as double,
      );

      if (locationResult != null) {
        String? province = locationResult.province;
        String? city = locationResult.city;
        final district = locationResult.district;

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
                _filteredCounties.addAll(
                    ChinaRegions.getCounties(matchedProvince, matchedCity));
              });
            }
          }

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                    '定位成功: ${locationResult.formattedAddress ?? '$province $city'}'),
                duration: const Duration(seconds: 2),
              ),
            );
          }

          final smallest = BankRegionUtils.pickSmallestRegion(
            province: province,
            city: city,
            district: district,
          );
          if (smallest != null && smallest.isNotEmpty) {
            setState(() {
              _useCustomRegion = true;
              _customRegionController.text = smallest;
            });
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('无法解析位置信息'),
                duration: Duration(seconds: 2),
              ),
            );
          }
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('无法获取位置信息'),
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error in auto location: $e');
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('定位失败: $e'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLocating = false;
        });
      }
    }
  }

  Future<Map<String, double>?> _getCurrentLocation() async {
    try {
      if (kIsWeb) {
        return await _getCurrentLocationWeb();
      } else {
        return await _getCurrentLocationNative();
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error getting current location: $e');
      }
      return null;
    }
  }

  Future<Map<String, double>?> _getCurrentLocationWeb() async {
    try {
      if (!kIsWeb) {
        return null;
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Web平台暂不支持定位功能，请使用移动设备'),
            duration: Duration(seconds: 2),
          ),
        );
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('Error getting web location: $e');
      }
      return null;
    }
  }

  Future<Map<String, double>?> _getCurrentLocationNative() async {
    try {
      if (kIsWeb) {
        return null;
      }

      // Check location service enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('定位服务未开启，请在设置中开启定位服务'),
              duration: Duration(seconds: 2),
            ),
          );
        }
        return null;
      }

      // Request location permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('定位权限被拒绝'),
                duration: Duration(seconds: 2),
              ),
            );
          }
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (mounted) {
          final shouldOpen = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('定位权限'),
              content: const Text('定位权限被永久拒绝，请在设置中手动开启定位权限'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('取消'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('去设置'),
                ),
              ],
            ),
          );

          if (shouldOpen == true) {
            await openAppSettings();
          }
        }
        return null;
      }

      // Get current position
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      return {
        'latitude': position.latitude,
        'longitude': position.longitude,
      };
    } catch (e) {
      if (kDebugMode) {
        print('Error getting native location: $e');
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('获取位置失败: $e'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
      return null;
    }
  }

  Future<void> _saveRegion() async {
    final provider = Provider.of<BankUserProvider>(context, listen: false);

    String? location;
    String? city;

    if (_useCustomRegion) {
      final customRegion = _customRegionController.text.trim();
      if (customRegion.isNotEmpty) {
        location = customRegion;
        city = customRegion;
      }
    } else {
      location = _selectedProvince;
      city = _selectedCounty ?? _selectedCity ?? _selectedProvince;
    }

    if (location != null || city != null) {
      await provider.updateGlobalState(location: location, city: city);
      await provider.updateUser(location: location, city: city);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('地区设置成功'),
            duration: Duration(seconds: 2),
          ),
        );
        context.pop();
      }
    }
  }

  @override
  void dispose() {
    _customRegionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          '地区设置',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF74B9FF),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isLocating ? null : _handleAutoLocation,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF74B9FF),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(BankConstants.borderRadius),
                      ),
                    ),
                    icon: _isLocating
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Icon(Icons.my_location, size: 20),
                    label: Text(
                      _isLocating ? '定位中...' : '一键定位',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        onChanged: _filterRegions,
                        decoration: InputDecoration(
                          hintText: '搜索省/市/县',
                          prefixIcon: const Icon(Icons.search),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(
                                BankConstants.borderRadius),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Switch(
                      value: _useCustomRegion,
                      onChanged: (value) {
                        setState(() {
                          _useCustomRegion = value;
                        });
                      },
                    ),
                    const Text('自定义'),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: _useCustomRegion
                ? _buildCustomRegionInput()
                : _buildRegionSelector(),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _saveRegion,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF74B9FF),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(BankConstants.borderRadius),
                  ),
                ),
                child: const Text(
                  '保存',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomRegionInput() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: TextField(
        controller: _customRegionController,
        decoration: InputDecoration(
          labelText: '自定义地区',
          hintText: '请输入地区名称',
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          ),
          prefixIcon: const Icon(Icons.location_on),
        ),
      ),
    );
  }

  Widget _buildRegionSelector() {
    return Row(
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
    );
  }

  Widget _buildProvinceList() {
    final provinces = _searchQuery.isEmpty
        ? _filteredProvinces
        : _filteredProvinces.where((p) => p.contains(_searchQuery)).toList();

    return Container(
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(color: Colors.grey[300]!),
        ),
      ),
      child: ListView.builder(
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
                ? const Icon(Icons.check, color: Color(0xFF74B9FF))
                : null,
          );
        },
      ),
    );
  }

  Widget _buildCityList() {
    final cities = _searchQuery.isEmpty
        ? _filteredCities
        : _filteredCities.where((c) => c.contains(_searchQuery)).toList();

    return Container(
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(color: Colors.grey[300]!),
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
                ? const Icon(Icons.check, color: Color(0xFF74B9FF))
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

    return ListView.builder(
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
              ? const Icon(Icons.check, color: Color(0xFF74B9FF))
              : null,
        );
      },
    );
  }
}
