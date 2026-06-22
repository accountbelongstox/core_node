import 'package:flutter/material.dart';
import '../../../models_app_travel/city_model.dart';
import '../../../widgets/travel_icons.dart';

class CitySearchWidget extends StatefulWidget {
  final Map<String, List<CityModel>> cityList;
  final VoidCallback? onClose;
  final Function(CityModel)? onCitySelected;

  const CitySearchWidget({
    super.key,
    required this.cityList,
    this.onClose,
    this.onCitySelected,
  });

  @override
  State<CitySearchWidget> createState() => _CitySearchWidgetState();
}

class _CitySearchWidgetState extends State<CitySearchWidget> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  bool _isFocused = false;
  List<CityModel> _searchResults = [];

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onSearchChanged);
    _focusNode.addListener(_onFocusChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onSearchChanged);
    _focusNode.removeListener(_onFocusChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final keyword = _controller.text.trim();
    if (keyword.isEmpty) {
      setState(() {
        _searchResults = [];
      });
      return;
    }

    final results = <CityModel>[];
    for (final key in widget.cityList.keys) {
      for (final city in widget.cityList[key]!) {
        if (city.name.contains(keyword) || city.spell.contains(keyword)) {
          results.add(city);
        }
      }
    }

    setState(() {
      _searchResults = results;
    });
  }

  void _onFocusChanged() {
    setState(() {
      _isFocused = _focusNode.hasFocus;
    });
  }

  void _onCancel() {
    _controller.clear();
    _focusNode.unfocus();
  }

  void _onCityTapped(CityModel city) {
    if (widget.onCitySelected != null) {
      widget.onCitySelected!(city);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasKeyword = _controller.text.trim().isNotEmpty;
    final showResults = hasKeyword && _searchResults.isEmpty;

    return Container(
      color: _isFocused ? const Color(0x33000000) : Colors.transparent,
      child: Column(
        children: [
          Container(
            height: 80.0,
            color: Colors.white,
            child: Row(
              children: [
                if (!_isFocused)
                  GestureDetector(
                    onTap: widget.onClose,
                    child: Container(
                      padding: const EdgeInsets.only(left: 38.0, right: 14.0),
                      child: Icon(
                        TravelIcons.close,
                        size: 12.0,
                        weight: 700,
                      ),
                    ),
                  ),
                Expanded(
                  child: Container(
                    height: 56.0,
                    margin: const EdgeInsets.symmetric(horizontal: 24.0),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEEEEE),
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          left: 36.0,
                          top: 0,
                          bottom: 0,
                          child: Center(
                            child: Icon(
                              TravelIcons.search,
                              size: 16.0,
                              color: Colors.grey[600],
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(left: 56.0, right: 24.0),
                          child: Center(
                            child: TextField(
                              controller: _controller,
                              focusNode: _focusNode,
                              decoration: const InputDecoration(
                                hintText: '搜索全球城市',
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.zero,
                              ),
                              style: const TextStyle(fontSize: 14.0),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_isFocused)
                  GestureDetector(
                    onTap: _onCancel,
                    child: Container(
                      padding: const EdgeInsets.only(right: 24.0),
                      child: const Text(
                        '取消',
                        style: TextStyle(
                          fontSize: 14.0,
                          height: 56.0 / 14.0,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (hasKeyword)
            Expanded(
              child: Container(
                color: Colors.white,
                child: Stack(
                  children: [
                    Positioned(
                      left: 0,
                      right: 0,
                      top: 0,
                      height: 2.0,
                      child: Container(
                        color: const Color(0xFFEEEEEE),
                      ),
                    ),
                    if (showResults)
                      Center(
                        child: Container(
                          width: 400.0,
                          height: 400.0,
                          decoration: const BoxDecoration(
                            image: DecorationImage(
                              image: AssetImage(
                                'assets/apps/app_travel/images/no-result.png',
                              ),
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                      )
                    else
                      ListView.builder(
                        itemCount: _searchResults.length,
                        itemBuilder: (context, index) {
                          final city = _searchResults[index];
                          return GestureDetector(
                            onTap: () => _onCityTapped(city),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 40.0),
                              height: 84.0,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                border: Border(
                                  bottom: BorderSide(
                                    color: const Color(0xFFEEEEEE),
                                    width: 1.0,
                                  ),
                                ),
                              ),
                              alignment: Alignment.centerLeft,
                              child: Text(
                                city.name,
                                style: const TextStyle(
                                  fontSize: 14.0,
                                  color: Colors.black87,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
