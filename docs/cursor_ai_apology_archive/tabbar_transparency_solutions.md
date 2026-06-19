# Flutter TabBar TouMingHuaFangAnJiHe (20+ FangAn ) 

## FangAn 1: use Material 2 + TouMing Material BaoZhuang 
```dart
Widget _buildTabBar() {
return Theme(
data: Theme.of(context).copyWith(useMaterial3: false),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
elevation: 0,
child: TabBar(...),
),
);
}
```

## FangAn 2: Jin use Material 3 + SheZhiSuo have surface YanSe for TouMing 
```dart
Theme(
data: Theme.of(context).copyWith(
useMaterial3: false,
colorScheme: Theme.of(context).colorScheme.copyWith(
surface: Colors.transparent,
surfaceContainerHighest: Colors.transparent,
surfaceContainerHigh: Colors.transparent,
surfaceContainer: Colors.transparent,
surfaceContainerLow: Colors.transparent,
surfaceContainerLowest: Colors.transparent,
surfaceTint: Colors.transparent,
),
),
child: TabBar(...),
)
```

## FangAn 3: use TabBarThemeData + YiChuSuo have JiaoHuXiaoGuo 
```dart
Theme(
data: Theme.of(context).copyWith(
tabBarTheme: const TabBarThemeData(
overlayColor: WidgetStatePropertyAll(Colors.transparent),
splashFactory: NoSplash.splashFactory,
dividerColor: Colors.transparent,
),
highlightColor: Colors.transparent,
splashColor: Colors.transparent,
splashFactory: NoSplash.splashFactory,
),
child: TabBar(...),
)
```

## FangAn 4: use DecoratedBox TiDai Container
```dart
DecoratedBox(
decoration: const BoxDecoration(color: Colors.transparent),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 5: use Opacity forced TouMing ( not TuiJian , but Ke use ) 
```dart
Opacity(
opacity: 1.0,
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 6: use BackdropFilter ( MaoBoLiXiaoGuo , but KeSheZhiWanQuanTouMing ) 
```dart
BackdropFilter(
filter: ImageFilter.blur(sigmaX: 0, sigmaY: 0),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 7: use CustomPaint HuiZhiTouMingBeiJing 
```dart
CustomPaint(
painter: TransparentPainter(),
child: TabBar(...),
)

class TransparentPainter extends CustomPainter {
@override
void paint(Canvas canvas, Size size) {
// not HuiZhiRenHe within Rong , BaoChiTouMing 
}

@override
bool shouldRepaint(CustomPainter oldDelegate) => false;
}
```

## FangAn 8: use ClipRect CaiJian 
```dart
ClipRect(
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 9: use RepaintBoundary GeLiZhongHui 
```dart
RepaintBoundary(
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 10: use IgnorePointer + Material TouMing ( such as Guo not XuYaoJiaoHu ) 
```dart
IgnorePointer(
ignoring: false,
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 11: use Builder QueBaoZhengQue Context
```dart
Builder(
builder: (BuildContext context) {
return Theme(
data: Theme.of(context).copyWith(useMaterial3: false),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
);
},
)
```

## FangAn 12: use InheritedWidget ChuanDiTouMing Theme
```dart
class TransparentTabBarTheme extends InheritedWidget {
final ThemeData theme;

const TransparentTabBarTheme({
super.key,
required this.theme,
required super.child,
});

static ThemeData of(BuildContext context) {
return context.dependOnInheritedWidgetOfExactType<TransparentTabBarTheme>()?.theme ?? ThemeData.fallback();
}

@override
bool updateShouldNotify(TransparentTabBarTheme oldWidget) {
return theme != oldWidget.theme;
}
}

TransparentTabBarTheme(
theme: Theme.of(context).copyWith(useMaterial3: false),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 13: use ZiDingYi TabBar ShiXian ( WanQuanKongZhi ) 
```dart
class CustomTransparentTabBar extends StatelessWidget {
final TabController controller;
final List<String> tabs;

@override
Widget build(BuildContext context) {
return Row(
children: tabs.asMap().entries.map((entry) {
final index = entry.key;
final text = entry.value;
final isSelected = controller.index == index;

return Expanded(
child: GestureDetector(
onTap: () => controller.animateTo(index),
child: Container(
color: Colors.transparent,
padding: const EdgeInsets.symmetric(vertical: 12),
child: Column(
mainAxisSize: MainAxisSize.min,
children: [
Text(
text,
style: TextStyle(
color: isSelected ? Colors.white : const Color(0xFF80A1ED),
fontSize: 16,
fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
),
),
if (isSelected)
Container(
height: 3,
color: Colors.white,
margin: const EdgeInsets.only(top: 4),
),
],
),
),
),
);
}).toList(),
);
}
}
```

## FangAn 14: use Stack + Positioned ( such as Guo TabBar not in AppBar in ) 
```dart
Stack(
children: [
// BeiJingCeng 
Container(decoration: BoxDecoration(...)),
// TabBar Ceng 
Positioned.fill(
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
),
],
)
```

## FangAn 15: use ColoredBox forced YanSe 
```dart
ColoredBox(
color: Colors.transparent,
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 16: use Container + TouMing decoration
```dart
Container(
decoration: const BoxDecoration(color: Colors.transparent),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 17: use FittedBox ShiPei ( such as GuoChiCun have WenTi ) 
```dart
FittedBox(
fit: BoxFit.none,
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 18: use Transform.scale ( such as GuoSuoFang have WenTi ) 
```dart
Transform.scale(
scale: 1.0,
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 19: use AnimatedBuilder ( such as GuoXuYaoDongHua ) 
```dart
AnimatedBuilder(
animation: _tabController.animation!,
builder: (context, child) {
return Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(
controller: _tabController,
...,
),
);
},
)
```

## FangAn 20: use ValueListenableBuilder ( such as GuoXuYaoJianTingBianHua ) 
```dart
ValueListenableBuilder<ThemeData>(
valueListenable: _themeNotifier,
builder: (context, theme, child) {
return Theme(
data: theme.copyWith(useMaterial3: false),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
);
},
)
```

## FangAn 21: use StreamBuilder ( such as GuoXuYaoLiuShiGengXin ) 
```dart
StreamBuilder<ThemeData>(
stream: _themeStream,
builder: (context, snapshot) {
if (!snapshot.hasData) {
return const SizedBox.shrink();
}

return Theme(
data: snapshot.data!.copyWith(useMaterial3: false),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
);
},
)
```

## FangAn 22: use Consumer ( such as Guo use Provider) 
```dart
Consumer<ThemeProvider>(
builder: (context, themeProvider, child) {
return Theme(
data: themeProvider.theme.copyWith(useMaterial3: false),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
);
},
)
```

## FangAn 23: use Selector ( such as Guo use Provider, XuanZeXingJianTing ) 
```dart
Selector<ThemeProvider, ThemeData>(
selector: (context, provider) => provider.theme,
builder: (context, theme, child) {
return Theme(
data: theme.copyWith(useMaterial3: false),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
);
},
)
```

## FangAn 24: use ProxyWidget DaiLi Theme
```dart
class TransparentTabBarProxy extends ProxyWidget {
final ThemeData theme;

const TransparentTabBarProxy({
super.key,
required this.theme,
required super.child,
});

@override
Widget build(BuildContext context) {
return Theme(
data: theme.copyWith(useMaterial3: false),
child: child!,
);
}
}

TransparentTabBarProxy(
theme: Theme.of(context).copyWith(useMaterial3: false),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 25: use CustomClipper CaiJian ( such as GuoXuYaoTeShuXingZhuang ) 
```dart
class TransparentTabBarClipper extends CustomClipper<Rect> {
@override
Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width, size.height);

@override
bool shouldReclip(CustomClipper<Rect> oldClipper) => false;
}

ClipRect(
clipper: TransparentTabBarClipper(),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 26: use ShaderMask ( such as GuoXuYao SeQiXiaoGuo ) 
```dart
ShaderMask(
shaderCallback: (Rect bounds) => LinearGradient(
colors: [Colors.transparent, Colors.transparent],
).createShader(bounds),
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 27: use CompositedTransformTarget ( such as GuoXuYaoTeShuDing position ) 
```dart
CompositedTransformTarget(
link: _layerLink,
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 28: use CompositedTransformFollower ( such as GuoXuYaoGenSui ) 
```dart
CompositedTransformFollower(
link: _layerLink,
child: Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
)
```

## FangAn 29: use Overlay ( such as GuoXuYaoFuGaiCeng ) 
```dart
Overlay(
initialEntries: [
OverlayEntry(
builder: (context) => Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
),
),
],
)
```

## FangAn 30: use LayoutBuilder ( such as GuoXuYaoXiangYingShiBuJu ) 
```dart
LayoutBuilder(
builder: (context, constraints) {
return Material(
color: Colors.transparent,
type: MaterialType.transparency,
child: TabBar(...),
);
},
)
```

## ZuiJiaShiJian summary 

### TuiJianFangAn ( AnYouXianJi ) : 
1. ** FangAn 1**: ZuiJianDan , use Material 2 + TouMing Material
2. ** FangAn 3**: WanZhengSheZhi TabBarThemeData
3. ** FangAn 13**: such as GuoXuYaoWanQuanKongZhi , use ZiDingYi TabBar

### GuanJianDian : 
1. **useMaterial3: false** - Jin use Material 3 BiMianMoRenBeiJingSe 
2. **MaterialType.transparency** - SheZhi Material for TouMingLeiXing 
3. **overlayColor: WidgetStatePropertyAll(Colors.transparent)** - YiChuSuo have JiaoHuXiaoGuo 
4. **splashFactory: NoSplash.splashFactory** - YiChu splash XiaoGuo 
5. ** YiChuSuo have ColorScheme surface XiangGuanYanSeSheZhi ** - such as Guo use Material 2 Ze not XuYao 

### DangQianDaiMa use FangAn : 
DangQianDaiMa use ** FangAn 1 + FangAn 3** ZuHe , this is ZuiJianJie have Xiao FangAn . 
