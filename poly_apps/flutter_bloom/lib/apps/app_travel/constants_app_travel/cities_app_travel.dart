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

class CitiesAppTravel {
  static const List<String> popularCities = [
    'Beijing',
    'Shanghai',
    'Guangzhou',
    'Shenzhen',
    'Chengdu',
    'Hangzhou',
    'Chongqing',
    'Wuhan',
    'Xi\'an',
    'Suzhou',
    'Tianjin',
    'Nanjing',
    'Zhengzhou',
    'Changsha',
    'Shenyang',
    'Qingdao',
    'Xiamen',
    'Dalian',
    'Kunming',
    'Luoyang',
    '塞班',
  ];

  static const List<String> allCities = [
    'Beijing',
    'Shanghai',
    'Guangzhou',
    'Shenzhen',
    'Chengdu',
    'Hangzhou',
    'Chongqing',
    'Wuhan',
    'Xi\'an',
    'Suzhou',
    'Tianjin',
    'Nanjing',
    'Zhengzhou',
    'Changsha',
    'Shenyang',
    'Qingdao',
    'Xiamen',
    'Dalian',
    'Kunming',
    'Luoyang',
    '塞班',
    'Harbin',
    'Jinan',
    'Fuzhou',
    'Shijiazhuang',
    'Changchun',
    'Taiyuan',
    'Nanchang',
    'Guiyang',
    'Nanning',
    'Hefei',
    'Urumqi',
    'Hohhot',
    'Lhasa',
    'Lanzhou',
    'Yinchuan',
    'Xining',
    'Haikou',
    'Sanya',
  ];

  static const String defaultCity = '塞班';

  static bool isCityValid(String city) {
    return allCities.contains(city);
  }
}
