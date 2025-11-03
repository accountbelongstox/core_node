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
import '../../../models_app_travel/grid_nav_model.dart';

class HomeGridNav extends StatelessWidget {
  final GridNavModel gridNav;
  final bool isFirst;

  const HomeGridNav({
    Key? key,
    required this.gridNav,
    this.isFirst = false,
  }) : super(key: key);

  String _getBackgroundImage(String title, int index) {
    const Map<String, List<String>> imageMap = {
      'grid-nav-hotel': [
        'assets/apps/app_travel/images/grid-nav-items-hotel@v7.15.png',
        'assets/apps/app_travel/images/grid-nav-items-minsu@v7.15.png',
        'assets/apps/app_travel/images/grid-nav-items-jhj@v7.15.png',
      ],
      'grid-nav-flight': [
        'assets/apps/app_travel/images/grid-nav-items-flight@v7.15.png',
        'assets/apps/app_travel/images/grid-nav-items-train.png',
        '',
        '',
      ],
      'grid-nav-travel': [
        'assets/apps/app_travel/images/grid-nav-items-travel@v7.15.png',
        'assets/apps/app_travel/images/grid-nav-items-dingzhi@v7.15.png',
        '',
        '',
      ],
    };
    return imageMap[title]?[index] ?? '';
  }

  LinearGradient _getGradient(String title) {
    const Map<String, LinearGradient> gradientMap = {
      'grid-nav-hotel': LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [Color(0xFFFA5956), Color(0xFFFB8650)],
        stops: [0.0, 0.54],
      ),
      'grid-nav-flight': LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [Color(0xFF4B8FED), Color(0xFF53BCED)],
      ),
      'grid-nav-travel': LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [Color(0xFF34C2AA), Color(0xFF6CD557)],
      ),
    };
    return gradientMap[title] ?? const LinearGradient(colors: [Colors.grey, Colors.grey]);
  }

  Widget _buildGridItem(BuildContext context, GridNavChildModel item, int index, String title) {
    final imagePath = _getBackgroundImage(title, index);
    final isFirst = index == 0;
    final isSpecialThird = title == 'grid-nav-hotel' && index == 2;

    int flex = 23;
    if (isFirst) {
      flex = 31;
    } else if (isSpecialThird) {
      flex = 46;
    }

    Widget background = Container();
    if (imagePath.isNotEmpty) {
      if (isFirst) {
        background = Positioned(
          right: 0,
          bottom: 0,
          child: Image.asset(
            imagePath,
            width: 146.0,
            fit: BoxFit.contain,
            alignment: Alignment.bottomRight,
          ),
        );
      } else if (index == 1 && !isSpecialThird) {
        background = Positioned(
          left: 0,
          bottom: 0,
          child: Image.asset(
            imagePath,
            width: 74.0,
            fit: BoxFit.contain,
            alignment: Alignment.bottomLeft,
          ),
        );
      } else if (isSpecialThird) {
        background = Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [Color(0xFFFFBC49), Color(0xFFFFD252)],
              ),
            ),
            child: Align(
              alignment: Alignment.bottomRight,
              child: Image.asset(
                imagePath,
                width: 173.0,
                fit: BoxFit.contain,
              ),
            ),
          ),
        );
      }
    }

    return Expanded(
      flex: flex,
      child: GestureDetector(
        onTap: () {
          debugPrint('Grid item tapped: ${item.title}');
        },
        child: Container(
          decoration: BoxDecoration(
            border: index > 0
                ? const Border(
                    left: BorderSide(color: Colors.white, width: 2.0),
                  )
                : null,
          ),
          child: Stack(
            children: [
              background,
              Container(
                width: double.infinity,
                height: double.infinity,
                alignment: isFirst ? Alignment.centerLeft : Alignment.center,
                padding: isFirst
                    ? const EdgeInsets.only(left: 24.0)
                    : EdgeInsets.zero,
                child: item.hasSubtitle
                    ? Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: isFirst ? CrossAxisAlignment.start : CrossAxisAlignment.center,
                        children: [
                          Text(
                            item.title,
                            style: TextStyle(
                              color: isSpecialThird ? const Color(0xFFA05416) : Colors.white,
                              fontSize: 16.0,
                              fontWeight: FontWeight.bold,
                              height: 1.2,
                            ),
                            textAlign: isFirst ? TextAlign.left : TextAlign.center,
                          ),
                          const SizedBox(height: 2.0),
                          Text(
                            item.subtitle!,
                            style: TextStyle(
                              color: isSpecialThird ? const Color(0xFFA05416) : Colors.white,
                              fontSize: 11.0,
                              fontWeight: FontWeight.normal,
                              height: 1.2,
                            ),
                            textAlign: isFirst ? TextAlign.left : TextAlign.center,
                          ),
                        ],
                      )
                    : Text(
                        item.title,
                        style: TextStyle(
                          color: isSpecialThird ? const Color(0xFFA05416) : Colors.white,
                          fontSize: 16.0,
                          fontWeight: FontWeight.normal,
                        ),
                        textAlign: isFirst ? TextAlign.left : TextAlign.center,
                      ),
              ),
              if (item.hasTag)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(12.0, 2.0, 12.0, 2.0),
                    decoration: const BoxDecoration(
                      color: Color(0xFFFFF500),
                      borderRadius: BorderRadius.only(
                        bottomLeft: Radius.circular(12.0),
                      ),
                    ),
                    child: Text(
                      item.tag!,
                      style: const TextStyle(
                        fontSize: 11.0,
                        color: Color(0xFFF54C45),
                        fontWeight: FontWeight.w500,
                        height: 1.2,
                      ),
                    ),
                  ),
                ),
              if (item.hasHot)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 3.0),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF54C45),
                      borderRadius: BorderRadius.only(
                        topRight: Radius.circular(8.0),
                        bottomLeft: Radius.circular(12.0),
                      ),
                    ),
                    child: Text(
                      item.hot!,
                      style: const TextStyle(
                        fontSize: 10.0,
                        color: Colors.white,
                        fontWeight: FontWeight.w500,
                        height: 1.2,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final rowHeight = screenWidth * 0.176;

    return Container(
      height: rowHeight,
      decoration: BoxDecoration(
        gradient: _getGradient(gridNav.title),
        border: isFirst
            ? null
            : const Border(
                top: BorderSide(color: Colors.white, width: 2.0),
              ),
      ),
      child: Row(
        children: gridNav.children.asMap().entries.map((entry) {
          return _buildGridItem(context, entry.value, entry.key, gridNav.title);
        }).toList(),
      ),
    );
  }
}
