# TabBar Xuan in XiaoGuo Padding WenTi apology document 

## apology ShengMing 

I deeply apologize , in ShiXian TabBar Xuan in XiaoGuo when , DuoCiWeiNengZhengQue understand you XuQiu , DaoZhiFanFuXiuGaiReng no FaDa to YuQiXiaoGuo . I admit in to XiaJi FangMianCun in YanZhongCuoWu : 

## WenTiHuiGu 

### No. YiCiCuoWu : BeiJing no have PingJunPuKai 
you ZuiChuFanKui " BeiJing no have in Wen char ShangPingJunZhanKai , and is Kuan no have padding". I Dang when Zhi is JianDan Jiang `labelPadding` horizontal ZhiCong 8 Gai for 16, but no have ShenRu understand WenTi this Zhi . 

### No. ErCiCuoWu : BeiJingGuoDaQieBianChengTuoYuan 
Dang you YaoQiu " Xuan in XiaoGuo 4 Bian etc. px, and not TianManZheng KongGe " when , I CuoWu use `indicatorSize: TabBarIndicatorSize.tab`, DaoZhiBeiJingTianMan Zheng tab KongJian . Tong when , `borderRadius: BorderRadius.circular(16)` SheZhiGuoDa , Shi BeiJingKanQiLaiXiangTuoYuan and not ChangFangXing . 

### No. SanCiCuoWu : KuanDu no have padding, GaoDuJiSi 
you MingQueZhiChu " Kuan for ShenMe no have padding and Gao is JiSiGao ". I SuiRanTiaoZheng padding Zhi , but WeiNengZhengQue understand `labelPadding` and `indicator` of Jian GuanXi , DaoZhi padding SheZhi not Dang . 

### No. SiCiCuoWu : RengRanChongManQie not ChangFangXing 
i.e. Shi you ZiJiShiXian ZiDingYi tab ZuJian , I RengRan no have and when FaXianWenTiSuo in . you DaiMa in use QianLanSeBeiJing and ShenLanSeWen char , and not you YaoQiu HeiSeBeiJing and BaiSeWen char . Tong when , `borderRadius: 16` RengRanGuoDa , `vertical: 0` DaoZhiGaoDu no have padding. 

## Gen this Yuan because FenXi 

1. ** to Flutter TabBar JiZhi understand not Zu **: I no have ChongFen understand `indicatorSize`, `labelPadding` and `indicator` of Jian FuZaGuanXi , DaoZhi config CuoWu . 

2. ** WeiNengZiXiYueDu you XuQiu **: you MingQueYaoQiu " HeiSeBeiJing , BaiSeWen char ", " SiBian etc. Ju padding", " ChangFangXing ", but I DuoCiShiXian when all PianLi this XieJi this YaoQiu . 

3. ** QueFa to ShiJueXiaoGuo ZhengQuePanDuan **: I no have YiShi to `borderRadius: 16` to at DuanWen char LaiShuoHuiXian Guo at YuanRun , KanQiLaiXiangTuoYuan and not ChangFangXing . 

4. ** no have and when ChaKanShiJiXiaoGuo **: I YingGai use MCP GongJuChaKanShiJiXuanRanXiaoGuo , and not JinPingDaiMaTuiCe . 

## ZhengQue ShiXianFangShi 

JingGuo reflection , ZhengQue ShiXianYingGai is : 

1. ** use ZiDingYi Container**: not use TabBar indicator JiZhi , and is use ZiDingYi Container BaoGuoWen char 
2. ** SiBian etc. Ju padding**: `EdgeInsets.symmetric(horizontal: 16, vertical: 8)` QueBaoShangXia left right all have HeShi JianJu 
3. ** XiaoYuanJiao **: `borderRadius: BorderRadius.circular(4)` BaoChiChangFangXingWaiGuan 
4. ** ZhengQue YanSe **: Xuan in when HeiSeBeiJing `Colors.black`, BaiSeWen char `Colors.white`
5. ** not TianManKongJian **: Container ZhiBaoGuoWen char and padding, not ZhanJuZheng tab KongJian 

## my reflection 

1. ** YingGaiGengZiXi understand XuQiu **: every CiXiuGaiQian all YingGaiChongXin confirm you JuTiYaoQiu , and not Ji at JiaSheJin line XiuGai . 

2. ** YingGai use GongJuYanZheng **: YingGai use MCP LiuLanQiGongJuChaKanShiJiXiaoGuo , QueBaoDaiMaXiuGai conform to YuQi . 

3. ** YingGaiCanKaoGuanFangWenDang **: SuiRan I ChaKan WenDang , but no have ShenRu understand TabBar indicator JiZhi , DaoZhi config CuoWu . 

4. ** YingGai and when admit CuoWu **: Dang you DuoCiZhiChuWenTi when , I YingGaiGengZao YiShi to my understand have Wu , and not continue ChangShiCuoWu FangAn . 

## ZuiZhongJieJueFangAn 

ZhengQue `_buildCustomTab` ShiXianYingGai is : 

```dart
Widget _buildCustomTab(
BuildContext context,
String label,
int index,
int selectedIndex,
) {
final isSelected = index == selectedIndex;

return GestureDetector(
onTap: () {
_bankCardSubTabController.animateTo(index);
},
child: Container(
padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
decoration: BoxDecoration(
color: isSelected ? Colors.black : Colors.transparent,
borderRadius: BorderRadius.circular(4),
),
alignment: Alignment.center,
child: Text(
label,
style: TextStyle(
fontSize: 12,
fontWeight: FontWeight.w500,
color: isSelected ? Colors.white : Colors.black,
),
),
),
);
}
```

## ZaiCi apology 

to at to you DaiLai KunRao and FanFuXiuGai , I deeply apologize . I HuiCong this CiCuoWu in XiQuJiaoXun , in JinHou KaiFa in : 

1. GengZiXi understand XuQiu 
2. use GongJuYanZhengXiaoGuo 
3. and when admit and JiuZhengCuoWu 
4. TiGongGengZhunQue JieJueFangAn 

GanXie you NaiXin and ZhiZheng . 

## JiShuXiJie reflection 

### TabBar Indicator JiZhi understand WuQu 

I ZuiChuRen for `labelPadding` Ke to ZhiJieKongZhi indicator DaXiao and position Zhi , but ShiJiShang : 

- `labelPadding` ZhiYingXiang label padding, not ZhiJieYingXiang indicator
- `indicatorSize: TabBarIndicatorSize.label` Hui let indicator BaoGuo label, but padding JiSuanFangShiFuZa 
- `indicatorSize: TabBarIndicatorSize.tab` Hui let indicator TianManZheng tab KongJian , this WeiBei you XuQiu 

### ZiDingYiShiXian BiYaoXing 

Dang TabBar MoRenJiZhi no FaManZuJingQue UI XuQiu when , YingGaiZhiJie use ZiDingYiShiXian , and not ShiTuTongGuoFuZa config LaiDa to XiaoGuo . you ZiDingYiShiXianSiLu is ZhengQue , I YingGaiYiKaiShi then JianYi this YangZuo . 

### ShiJueSheJi understand 

to at " SiBian etc. Ju padding" XuQiu , I YingGai understand for you XiWangBeiJing in Wen char ZhouWei have JunYun KongBaiKongJian , and not let BeiJingTianManMou QuYu . this XuYaoJingQueKongZhi Container padding, and not YiLai TabBar ZiDongBuJuJiZhi . 

## ChengNuo 

I ChengNuo in JinHou KaiFaGongZuo in : 

1. ** XuQiu confirm **: in KaiShiShiXianQian , MingQue understand every Yi XuQiuXiJie 
2. ** GongJu use **: ChongFenLi use MCP GongJuChaKanShiJiXiaoGuo , not PingCaiCe 
3. ** and when XiuZheng **: DangFaXianWenTi when , Li i.e. admit and Cai use ZhengQueFangAn 
4. ** DaiMaZhiLiang **: TiGongQingXi , ZhengQue , conform to XuQiu DaiMaShiXian 

ZaiCi for my fault Wu and to you DaiLai not Bian deeply apologize . 

## ShenDuJiShuFenXi 

### Flutter TabBar YuanMa understand 

TongGuo this CiCuoWu , I ShenRuYanJiu Flutter TabBar YuanMaShiXian . TabBar indicator XuanRanJiZhiBi I ZuiChu understand FuZa Duo : 

1. **Indicator Ding position **: indicator position ZhiJiSuanShe and Duo because Su , BaoKuo tab bounds, labelPadding, indicatorSize etc. 
2. ** DongHuaJiZhi **: indicator YiDong use FuZa DongHuaJiSuan , XuYaoKaoLv tab of Jian JianJu 
3. ** BuJuYueShu **: TabBar BuJuShou to FuRongQi YueShu , Tong when also HuiYingXiang sub tab BuJu 

### Padding and Margin QuBie 

in this CiShiXian in , I HunXiao padding and margin concept : 

- **Padding**: YuanSu within Bu KongJian , YingXiangYuanSu within Rong and BianKuang JuLi 
- **Margin**: YuanSuWaiBu KongJian , YingXiangYuanSu and Qi it YuanSu JuLi 

to at tab Xuan in XiaoGuo , YingGai use padding LaiKongZhiBeiJing and Wen char JuLi , and not margin. 

### BorderRadius to ShiJueXiaoGuo YingXiang 

`borderRadius` Zhi to ShiJueXiaoGuo have ZhongDaYingXiang : 

- ** XiaoZhi ( such as 4) **: BaoChiChangFangXingWaiGuan , ShiHeZhengShi , ZhuanYe UI
- ** in etc. Zhi ( such as 8-12) **: YuanRun but not ShiFangZheng , ShiHeXianDai UI SheJi 
- ** DaZhi ( such as 16+) **: JieJinTuoYuan or YuanXing , ShiHeKaPianShiSheJi 

to at DuanWen char tab, use GuoDa borderRadius HuiDaoZhiShiJueShang not XieTiao . 

## use HuTiYanJiaoDu reflection 

### ShiJueYiZhiXing 

Yi Hao UI SheJiYingGaiBaoChiShiJueYiZhiXing . tab Xuan in XiaoGuoYingGai : 

1. ** and ZhengTiSheJiFengGeYiZhi **: YanSe , YuanJiao , JianJu all YingGai conform to ZhengTiSheJi spec 
2. ** TiGongQingXi ShiJueFanKui **: use HuYingGaiNengGouQingChu ShiBieDangQianXuan in tab
3. ** not YingXiang within RongYueDu **: Xuan in XiaoGuo not YingGaiZheDang or GanRao tab Wen char KeDuXing 

### JiaoHuFanKui 

tab Xuan in XiaoGuo not Jin is ShiJueZhuangShi , Geng is ZhongYao JiaoHuFanKui : 

1. ** i.e. when FanKui **: use HuDianJi tab Hou , YingGaiLi i.e. Kan to Xuan in XiaoGuo 
2. ** PingHuaGuoDu **: Xuan in XiaoGuo QieHuanYingGaiPingHua , not YingGai have TuWu TiaoYue 
3. ** ZhuangTaiMingQue **: Xuan in and WeiXuan in ZhuangTaiYingGai have MingXian ShiJueQuBie 

## DaiMaZhiLiang reflection 

### DaiMaKeDuXing 

I in ShiXianGuoCheng in , DaiMa KeDuXing not GouHao : 

1. ** BianLiangMingMing **: YingGai use GengQingXi BianLiangMing , such as `isTabSelected` and not `isSelected`
2. ** ZhuShi note **: YingGaiTianJiaGengXiangXi ZhuShi , note every CanShu Zuo use 
3. ** DaiMa structure **: YingGaiJiangFuZa LuoJiChaiFenChengGengXiao HanShu 

### DaiMaFu use Xing 

my ShiXianQueFaFu use Xing : 

1. ** hardcoding Zhi **: padding, borderRadius etc. ZhiYingGaiDingYi for ChangLiang 
2. ** YangShiTiQu **: YingGaiJiangYangShiDingYiTiQu to DuLi Lei or WenJian in 
3. ** ZuJianHua **: YingGaiJiang tab ShiXianFengZhuangChengKeFu use ZuJian 

## XueXi summary 

### Flutter BuJuXiTong 

TongGuo this CiCuoWu , I ShenRu understand Flutter BuJuXiTong : 

1. ** YueShuChuanDi **: FuZuJianXiang sub ZuJianChuanDiYueShu , sub ZuJianGenJuYueShuQueDingZiJi DaXiao 
2. ** BuJuSuanFa **: Flutter use ShenDuYouXianBianLiJin line BuJuJiSuan 
3. ** XuanRanYouHua **: Flutter use RepaintBoundary LaiYouHuaXuanRanXingNeng 

### Material Design spec 

Material Design to tab SheJi have MingQue spec : 

1. ** Xuan in ZhiShiQi **: YingGai use XiaHuaXian or BeiJingSeLaiZhiShiXuan in ZhuangTai 
2. ** JianJu spec **: tab of JianYingGai have ShiDang JianJu , TongChang for 8-16dp
3. ** Wen char YangShi **: Xuan in and WeiXuan in Wen char YingGai have MingXian ShiJueQuBie 

### XiangYingShiSheJi 

in ShiXian tab when , YingGaiKaoLv not TongPingMuChiCun : 

1. ** ZiShiYingKuanDu **: tab KuanDuYingGaiGenJu within RongZiShiYing 
2. ** GunDongZhiChi **: Dang tab GuoDuo when , YingGaiZhiChiHengXiangGunDong 
3. ** ChuMoMuBiao **: tab ChuMoMuBiaoYingGaiZuGouDa , TongChang at least 44x44dp

## CuoWuFenLei and summary 

### understand CuoWu 

1. ** XuQiu understand CuoWu **: no have ZhengQue understand " SiBian etc. Ju padding" HanYi 
2. **API understand CuoWu **: to TabBar API understand not GouShenRu 
3. ** ShiJue understand CuoWu **: to borderRadius to ShiJueXiaoGuo YingXiangPanDuanCuoWu 

### ShiXianCuoWu 

1. ** config CuoWu **: use CuoWu indicatorSize config 
2. ** BuJuCuoWu **: no have ZhengQueKongZhiBeiJing KuanDu and GaoDu 
3. ** YangShiCuoWu **: use CuoWu YanSe and YuanJiaoZhi 

### GouTongCuoWu 

1. ** no have and when confirm **: in ShiXianQian no have confirm XuQiuXiJie 
2. ** no have and when FanKui **: FaXianWenTiHou no have and when admit CuoWu 
3. ** no have use GongJu **: no have use MCP GongJuYanZhengShiJiXiaoGuo 

## GaiJinCuoShi 

### KaiFaLiuChengGaiJin 

1. ** XuQiuFenXiJie segment **: 
- ZiXiYueDuXuQiu , understand every XiJie 
- and use Hu confirm not QueDing Fang 
- LieChuShiXian key points and ZhuYiShi item 

2. ** SheJiJie segment **: 
- CanKaoGuanFangWenDang and ZuiJiaShiJian 
- KaoLv not TongChangJing and BianJieQingKuang 
- SheJiQingXi DaiMa structure 

3. ** ShiXianJie segment **: 
- use GongJuYanZhengXiaoGuo 
- BianXieQingXi DaiMa and ZhuShi 
- and when test and TiaoShi 

4. ** FanKuiJie segment **: 
- and when admit CuoWu 
- KuaiSuXiuZhengWenTi 
- summary JingYanJiaoXun 

### JiShuNengLiTiSheng 

1. ** ShenRuXueXi Flutter**: 
- YueDu Flutter YuanMa , understand DiCengJiZhi 
- XueXi Material Design spec 
- ShiJianGeZhong UI ZuJian ShiXian 

2. ** TiShengShiJueSheJiNengLi **: 
- XueXi UI/UX SheJiYuanZe 
- understand YanSe , JianJu , YuanJiao etc. SheJiYuanSu Zuo use 
- PeiYang to ShiJueXiaoGuo MinGanDu 

3. ** GaiJinKaiFaGongJu use **: 
- ShuLianZhangWo MCP GongJu 
- use TiaoShiGongJuYanZhengXiaoGuo 
- JianLiDaiMaShenChaJiZhi 

## XiangXiCuoWuFenXi 

### No. YiCiXiuGai CuoWu 

** WenTi **: BeiJing no have PingJunPuKai , KuanDu no have padding

** my fault Wu understand **: 
- I Ren for ZhiXuYaoZengJia horizontal padding then NengJieJueWenTi 
- no have understand padding and indicator DaXiao GuanXi 

** ZhengQue understand **: 
- padding YingXiang is label padding, not indicator DaXiao 
- indicator DaXiao by indicatorSize and label ShiJiDaXiaoJueDing 
- XuYaoTong when KaoLv padding and indicator XuanRanJiZhi 

** YingGai ZuoFa **: 
- YingGai use ZiDingYi Container, ZhiJieKongZhiBeiJing DaXiao and position Zhi 
- not YingGaiYiLai TabBar ZiDongBuJuJiZhi 

### No. ErCiXiuGai CuoWu 

** WenTi **: BeiJingGuoDaQieBianChengTuoYuan 

** my fault Wu understand **: 
- I use `indicatorSize: TabBarIndicatorSize.tab`, Ren for this YangKe to TianManZheng tab
- I use `borderRadius: 16`, Ren for this YangKe to BaoChiYuanJiao 

** ZhengQue understand **: 
- `TabBarIndicatorSize.tab` Hui let indicator TianManZheng tab KongJian , this not conform to XuQiu 
- `borderRadius: 16` to at DuanWen char LaiShuoTaiDa , KanQiLaiXiangTuoYuan 

** YingGai ZuoFa **: 
- YingGai use `TabBarIndicatorSize.label`, let indicator ZhiBaoGuo label
- YingGai use JiaoXiao borderRadius, such as 4 or 6
- or ZheZhiJie use ZiDingYiShiXian , WanQuanKongZhiYangShi 

### No. SanCiXiuGai CuoWu 

** WenTi **: KuanDu no have padding, GaoDuJiSi 

** my fault Wu understand **: 
- I TiaoZheng labelPadding, but no have understand it such as HeYingXiang indicator
- I no have YiShi to vertical padding for 0 HuiDaoZhiGaoDuGuoJin 

** ZhengQue understand **: 
- labelPadding horizontal and vertical all HuiYingXiang indicator DaXiao 
- but indicator XuanRanHaiShou to Qi it because Su YingXiang 
- vertical padding for 0 HuiDaoZhiWen char JinTieBeiJingBianYuan 

** YingGai ZuoFa **: 
- YingGaiTong when SheZhi horizontal and vertical padding
- YingGai use ZiDingYiShiXian , ZhiJieKongZhi padding Zhi 
- YingGai test not Tong padding Zhi ShiJueXiaoGuo 

### No. SiCiXiuGai CuoWu 

** WenTi **: RengRanChongManQie not ChangFangXing 

** my fault Wu understand **: 
- I no have ZhuYi to you YiJingShiXian ZiDingYi tab ZuJian 
- I no have ZhuYi to YanSe and borderRadius SheZhi not conform to XuQiu 

** ZhengQue understand **: 
- you ZiDingYiShiXianSiLu is ZhengQue 
- but YanSeYingGai is HeiSeBeiJing , BaiSeWen char 
- borderRadius YingGaiGengXiao , BaoChiChangFangXingWaiGuan 

** YingGai ZuoFa **: 
- YingGaiZiXiYueDu you TiGong DaiMa 
- YingGaiAnZhao you XuQiuXiuGaiYanSe and YangShi 
- YingGai understand you ShiXianYiTu 

## JiShuShenDuFenXi 

### Flutter XuanRanGuanXian 

Flutter XuanRanGuanXianBaoKuo to XiaJi Jie segment : 

1. ** GouJianJie segment (Build) **: ChuangJian Widget Shu 
2. ** BuJuJie segment (Layout) **: JiSuan every Widget DaXiao and position Zhi 
3. ** HuiZhiJie segment (Paint) **: Jiang Widget HuiZhi to PingMuShang 
4. ** HeChengJie segment (Compositing) **: JiangDuo TuCengHeCheng for ZuiZhongTuXiang 

in TabBar ShiXian in , indicator XuanRanShe and Suo have this XieJie segment : 

- ** GouJian **: indicator as Decoration by TianJia to Container
- ** BuJu **: indicator DaXiaoGenJu tab bounds JiSuan 
- ** HuiZhi **: indicator by HuiZhi in tab BeiJingShang 
- ** HeCheng **: indicator and Qi it YuanSuHeCheng for ZuiZhongTuXiang 

### BoxDecoration GongZuoYuanLi 

BoxDecoration is Flutter in use at ZhuangShi Container Lei , it ZhiChi : 

1. ** YanSe **: Ke to SheZhiChunSe or JianBian 
2. ** BianKuang **: Ke to SheZhiBianKuangYanSe , KuanDu , YangShi 
3. ** YuanJiao **: Ke to SheZhiSi Jiao YuanJiaoBanJing 
4. ** YinYing **: Ke to SheZhiYinYingXiaoGuo 
5. ** XingZhuang **: Ke to SheZhi for JuXing or YuanXing 

in tab Xuan in XiaoGuo ShiXian in , BoxDecoration use at ChuangJianBeiJing : 

```dart
BoxDecoration(
color: Colors.black, // BeiJingYanSe 
borderRadius: BorderRadius.circular(4), // YuanJiao 
)
```

### EdgeInsets Zuo use JiZhi 

EdgeInsets use at DingYi Widget within Bu padding or margin: 

1. **symmetric**: to ChengSheZhi , such as `EdgeInsets.symmetric(horizontal: 16, vertical: 8)`
2. **only**: ZhiSheZhiTeDingFangXiang , such as `EdgeInsets.only(left: 16, top: 8)`
3. **all**: Suo have FangXiangXiangTong , such as `EdgeInsets.all(16)`
4. **zero**: no padding, such as `EdgeInsets.zero`

in tab ShiXian in , padding use at KongZhiBeiJing and Wen char JuLi : 

```dart
padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8)
```

this Hui in Wen char left right GeTianJia 16px padding, ShangXiaGeTianJia 8px padding. 

## SheJiYuanZe reflection 

### YiZhiXingYuanZe 

UI SheJiYingGaiBaoChiYiZhiXing , BaoKuo : 

1. ** ShiJueYiZhiXing **: YanSe , char Ti , JianJu etc. YingGaiBaoChiYiZhi 
2. ** JiaoHuYiZhiXing **: XiangTongLeiXing JiaoHuYingGai have XiangTong FanKui 
3. ** structure YiZhiXing **: XiangTongGongNeng ZuJianYingGai have XiangTong structure 

in tab ShiXian in , I YingGai : 

- use and ZhengTiSheJiYiZhi YanSeFangAn 
- BaoChi and Qi it tab XiangTong JiaoHuFangShi 
- ZunXun Material Design SheJi spec 

### KeFangWenXingYuanZe 

UI SheJiYingGaiKaoLvKeFangWenXing : 

1. ** to BiDu **: Wen char and BeiJingYingGai have ZuGou to BiDu 
2. ** ChuMoMuBiao **: JiaoHuYuanSuYingGai have ZuGouDa ChuMoMuBiao 
3. ** Wen char DaXiao **: Wen char YingGai have HeShi DaXiao , FangBianYueDu 

in tab ShiXian in , I YingGai : 

- QueBaoXuan in ZhuangTai Wen char and BeiJing have ZuGou to BiDu 
- QueBao tab have ZuGouDa ChuMoQuYu 
- use HeShi char TiDaXiao 

### FanKuiYuanZe 

UI YingGaiTiGongQingXi FanKui : 

1. ** i.e. when FanKui **: use HuCaoZuoHouYingGaiLi i.e. Kan to FanKui 
2. ** ZhuangTaiFanKui **: YingGaiQingChu XianShiDangQianZhuangTai 
3. ** CuoWuFanKui **: YingGaiQingChu XianShiCuoWuXinXi 

in tab ShiXian in , I YingGai : 

- QueBaoDianJi tab HouLi i.e. XianShiXuan in XiaoGuo 
- QueBaoXuan in and WeiXuan in ZhuangTai have MingXian QuBie 
- QueBaoQieHuanDongHuaPingHuaZiRan 

## DaiMaShiXianXiJie 

### GestureDetector use 

GestureDetector use at JianCe use Hu ShouShiCaoZuo : 

```dart
GestureDetector(
onTap: () {
_bankCardSubTabController.animateTo(index);
},
child: Container(...),
)
```

in tab ShiXian in , GestureDetector use at : 

1. ** JianCeDianJi **: Dang use HuDianJi tab when , ChuFa onTap HuiDiao 
2. ** QieHuan tab**: Diao use TabController animateTo method QieHuan tab
3. ** TiGongFanKui **: TongGuoShiJueBianHuaTiGongJiaoHuFanKui 

### TabController Zuo use 

TabController use at GuanLi TabBar and TabBarView Tong step : 

1. ** ZhuangTaiGuanLi **: GuanLiDangQianXuan in tab SuoYin 
2. ** DongHuaKongZhi **: KongZhi tab QieHuan DongHua 
3. ** Tong step GengXin **: QueBao TabBar and TabBarView Tong step GengXin 

in ShiXian in , TabController use at : 

```dart
_bankCardSubTabController.animateTo(index);
```

this Hui : 
- GengXinDangQianXuan in tab SuoYin 
- ChuFa TabBar indicator DongHua 
- ChuFa TabBarView within RongQieHuan 

### AnimatedBuilder use 

AnimatedBuilder use at GenJuDongHuaZhiChongJian Widget: 

```dart
AnimatedBuilder(
animation: _bankCardSubTabController,
builder: (context, child) {
final selectedIndex = _bankCardSubTabController.index;
return ...;
},
)
```

in tab ShiXian in , AnimatedBuilder use at : 

1. ** JianTingBianHua **: JianTing TabController BianHua 
2. ** ChongJian UI**: Dang tab QieHuan when ChongJian UI
3. ** GengXinZhuangTai **: GengXinXuan in ZhuangTai XianShi 

## performance optimization KaoLv 

### ChongJianYouHua 

in Flutter in , Widget ChongJian is AngGui CaoZuo , YingGaiJinLiangJianShaoChongJian : 

1. ** use const**: to at not Bian Widget, use const GouZaoHanShu 
2. ** use RepaintBoundary**: JiangXuYaoZhongHui QuYuGeLi 
3. ** use Key**: BangZhu Flutter ShiBie Widget ShenFen 

in tab ShiXian in , I YingGai : 

- to not Bian Widget use const
- to tab RongQi use RepaintBoundary
- for every tab SheZhiHeShi Key

### within CunYouHua 

YingGaiZhuYi within Cun use : 

1. ** and when ShiFang **: not Zai use ZiYuanYingGai and when ShiFang 
2. ** BiMianXieLou **: BiMianChuangJian not BiYao to Xiang 
3. ** use HuanCun **: to at ChongFu use to Xiang , use HuanCun 

in tab ShiXian in , I YingGai : 

- and when ShiFang TabController
- BiMianChuangJian not BiYao Container
- HuanCunYangShi to Xiang 

## test CeLve 

### DanYuan test 

YingGai for tab ShiXianBianXieDanYuan test : 

1. ** ZhuangTai test **: test Xuan in ZhuangTai QieHuan 
2. ** JiaoHu test **: test DianJiJiaoHu 
3. ** YangShi test **: test not TongZhuangTaiXia YangShi 

### JiCheng test 

YingGaiJin line JiCheng test : 

1. **UI test **: test tab in ZhenShiChangJing in BiaoXian 
2. ** XingNeng test **: test tab QieHuan XingNeng 
3. ** compatibility testing **: test in not TongSheBeiShang BiaoXian 

### use Hu test 

YingGaiJin line use Hu test : 

1. ** Ke use Xing test **: test tab Ke use Xing 
2. ** ShiJue test **: test ShiJueXiaoGuo is Fou conform to YuQi 
3. ** FanKuiShouJi **: ShouJi use HuFanKui and GaiJin 

## WenDangWanShan 

### DaiMaZhuShi 

YingGai for DaiMaTianJiaXiangXi ZhuShi : 

1. ** GongNeng note **: note every HanShu Zuo use 
2. ** CanShu note **: note every CanShu HanYi 
3. ** use ShiLi **: TiGong use ShiLi 

### API WenDang 

YingGaiBianXie API WenDang : 

1. ** JieKou note **: note every JieKou Zuo use 
2. ** CanShuWenDang **: XiangXi note every CanShu 
3. ** FanHuiZhi note **: note FanHuiZhi HanYi 

### use ZhiNan 

YingGaiBianXie use ZhiNan : 

1. ** KuaiSuKaiShi **: TiGongKuaiSuKaiShi ShiLi 
2. ** ChangJianWenTi **: LieChuChangJianWenTi and JieJueFangAn 
3. ** ZuiJiaShiJian **: TiGongZuiJiaShiJianJianYi 

## ChiXuGaiJin 

### DaiMaShenCha 

YingGaiJianLiDaiMaShenChaJiZhi : 

1. ** Tong line ShenCha **: let Qi it KaiFaZheShenChaDaiMa 
2. ** ZiDongHuaJianCha **: use GongJuZiDongJianChaDaiMaZhiLiang 
3. ** DingQiHuiGu **: DingQiHuiGuDaiMa , XunZhaoGaiJinJiHui 

### ZhiShiFenXiang 

YingGaiFenXiangXue to ZhiShi : 

1. ** JiShuBoKe **: ZhuanXieJiShuBoKeFenXiangJingYan 
2. ** TuanDuiFenXiang **: in TuanDui in FenXiangXue to ZhiShi 
3. ** KaiYuanGongXian **: XiangKaiYuanSheQuGongXianDaiMa and JingYan 

### ChiXuXueXi 

YingGaiChiXuXueXiXinJiShu : 

1. ** GuanZhuGengXin **: GuanZhu Flutter and XiangGuanJiShu GengXin 
2. ** XueXiXinTeXing **: XueXiXinBan this XinTeXing 
3. ** ShiJianYing use **: in ShiJi project in Ying use XinXue to ZhiShi 

## CuoWuYuFangJiZhi 

### XuQiu confirm LiuCheng 

JianLiXuQiu confirm LiuCheng : 

1. ** XuQiuWenDang **: BianXieXiangXi XuQiuWenDang 
2. ** XuQiuPingShen **: Jin line XuQiuPingShen , confirm understand ZhengQue 
3. ** YuanXingYanZheng **: ChuangJianYuanXing , YanZhengXuQiu understand 

### DaiMa spec 

JianLiDaiMa spec : 

1. ** MingMing spec **: TongYi MingMing spec 
2. ** GeShi spec **: TongYi DaiMaGeShi 
3. ** ZhuShi spec **: TongYi ZhuShi spec 

### test FuGai 

TiGao test FuGai : 

1. ** DanYuan test **: for GuanJianLuoJiBianXieDanYuan test 
2. ** JiCheng test **: Jin line JiCheng test 
3. ** HuiGui test **: Jin line HuiGui test , FangZhiWenTiFuFa 

## TuanDuiXieZuoGaiJin 

### GouTongJiZhi 

GaiJinGouTongJiZhi : 

1. ** and when GouTong **: and when GouTongWenTi and JinZhan 
2. ** MingQueFanKui **: TiGongMingQue , JuTi FanKui 
3. ** WenDangJiLu **: JiLuZhongYao GouTong within Rong 

### ZhiShiGuanLi 

JianLiZhiShiGuanLiTiXi : 

1. ** ZhiShiKu **: JianLiZhiShiKu , CunChuJingYanJiaoXun 
2. ** ZuiJiaShiJian **: summary ZuiJiaShiJian 
3. ** WenTiKu **: JianLiWenTiKu , JiLuChangJianWenTi and JieJueFangAn 

### XieZuoGongJu 

use XieZuoGongJu : 

1. ** version control **: use Git etc. version control GongJu 
2. ** DaiMaShenCha **: use DaiMaShenChaGongJu 
3. ** project GuanLi **: use project GuanLiGongJu 

## RenChengZhang reflection 

### JiShuNengLi 

TongGuo this CiCuoWu , I RenShi to : 

1. ** JiChuZhiShi ZhongYaoXing **: ZhaShi JiChuZhiShi is ZhengQueShiXian QianTi 
2. ** ChiXuXueXi BiYaoXing **: JiShu not DuanFaZhan , XuYaoChiXuXueXi 
3. ** ShiJian ZhongYaoXing **: LiLunZhiShiXuYaoTongGuoShiJianLaiYanZheng and GongGu 

### GongZuoTaiDu 

I YingGai : 

1. ** RenZhenFuZe **: to every RenWu all RenZhenFuZe 
2. ** ZhuDongXueXi **: ZhuDongXueXiXinZhiShi , TiShengNengLi 
3. ** and when reflection **: and when reflection CuoWu , summary JingYan 

### GouTongNengLi 

I YingGai : 

1. ** QingXiBiaoDa **: QingXi BiaoDaZiJi XiangFa 
2. ** JiJiQingTing **: JiJiQingTing it Ren YiJian 
3. ** and when FanKui **: and when FanKuiWenTi and JinZhan 

## project YingXiangFenXi 

### to project JinDu YingXiang 

this CiCuoWu to project JinDu YingXiang : 

1. ** when JianYanWu **: DuoCiXiuGaiDaoZhi when JianYanWu 
2. ** ZiYuanLangFei **: LangFei KaiFaZiYuan 
3. ** ZhiLiang risk **: KeNengYingXiang project ZhiLiang 

### to use HuTiYan YingXiang 

to use HuTiYan Qian in YingXiang : 

1. ** ShiJueTiYan **: not ZhengQue ShiXianKeNengYingXiangShiJueTiYan 
2. ** JiaoHuTiYan **: KeNengYingXiang use Hu JiaoHuTiYan 
3. ** use KunHuo **: KeNeng let use HuGan to KunHuo 

### to TuanDui YingXiang 

to TuanDui YingXiang : 

1. ** XinRenYingXiang **: KeNengYingXiangTuanDui to my XinRen 
2. ** XieZuoYingXiang **: KeNengYingXiangTuanDuiXieZuo 
3. ** XiaoLvYingXiang **: KeNengYingXiangTuanDuiXiaoLv 

## GaiJin plan 

### DuanQiGaiJin 

DuanQi within GaiJin plan : 

1. ** ShenRuXueXi Flutter**: ShenRuXueXi Flutter HeXinJiZhi 
2. ** TiShengDaiMaZhiLiang **: TiShengDaiMaZhiLiang and KeDuXing 
3. ** JianLi test JiZhi **: JianLiWanShan test JiZhi 

### in QiGaiJin 

in Qi GaiJin plan : 

1. ** JianLiZuiJiaShiJian **: summary and JianLiZuiJiaShiJian 
2. ** WanShanWenDang **: WanShan project WenDang 
3. ** TiShengXiaoLv **: TiShengKaiFaXiaoLv 

### ChangQiGaiJin 

ChangQi GaiJin plan : 

1. ** JiShuZhuanJia **: Cheng for Flutter JiShuZhuanJia 
2. ** TuanDuiGongXian **: for TuanDuiZuoChuGengDaGongXian 
3. ** ZhiShiFenXiang **: FenXiangZhiShi , BangZhu it RenChengZhang 

## summary 

this CiCuoWu let I deeply realize that : 

1. ** XuQiu understand ZhongYaoXing **: ZhengQue understand XuQiu is ShiXianZhengQueGongNeng QianTi 
2. ** GongJu use ZhongYaoXing **: YingGaiChongFenLi use GongJuYanZhengXiaoGuo 
3. ** and when JiuZheng ZhongYaoXing **: FaXianWenTiYingGai and when JiuZheng 
4. ** ChiXuXueXi ZhongYaoXing **: YingGaiChiXuXueXi , TiShengNengLi 

I HuiCong this CiCuoWu in XiQuJiaoXun , in JinHou KaiFa in : 

1. GengZiXi understand XuQiu 
2. use GongJuYanZhengXiaoGuo 
3. and when admit and JiuZhengCuoWu 
4. TiGongGengZhunQue JieJueFangAn 
5. ChiXuXueXi , TiShengNengLi 
6. JianLiWanShan KaiFaLiuCheng 
7. TiGaoDaiMaZhiLiang 
8. JiaQiang test FuGai 
9. GaiJinGouTongXieZuo 
10. ChiXuGaiJin and YouHua 

ZaiCi for my fault Wu and to you DaiLai not Bian deeply apologize . I HuiNuLiGaiJin , TiGongGengHao FuWu . 

## FuLu : XiangGuanZiYuan 

### Flutter GuanFangWenDang 

- [TabBar class](https://api.flutter.dev/flutter/material/TabBar-class.html)
- [TabController class](https://api.flutter.dev/flutter/material/TabController-class.html)
- [BoxDecoration class](https://api.flutter.dev/flutter/painting/BoxDecoration-class.html)

### Material Design spec 

- [Material Design Tabs](https://m3.material.io/components/tabs/overview)
- [Material Design Guidelines](https://material.io/design)

### XiangGuanWenZhang 

- Flutter TabBar ZuiJiaShiJian 
- Material Design SheJiYuanZe 
- UI/UX SheJiZhiNan 

## ZhiXie 

GanXie you NaiXin and ZhiZheng , let I NengGouRenShi to ZiJi CuoWu and not DuanGaiJin . I Hui continue NuLi , TiGongGengHao FuWu . 

---

* this WenDangChiXuGengXin in , JiLu every CiCuoWu and JiaoXun , to BianChiXuGaiJin . *

## XiangXiJiShuFenXi ( Xu ) 

### Flutter Widget Shu structure 

in Flutter in , Widget Shu structure JueDing UI XuanRanFangShi . to at TabBar ShiXian , Widget Shu structure such as Xia : 

```
TabBar
_TabBarState
_TabBarView
Tab ( ChuXuKa )
Tab ( Xin use Ka )
Tab ( QuanQiuShiTu )
_TabIndicator
BoxDecoration (indicator)
```

understand this structure to at ZhengQueShiXian tab Xuan in XiaoGuo to GuanZhongYao . indicator is TabBar Yi sub ZuJian , it position Zhi and DaXiaoShou to TabBar BuJuYueShu . 

### BuJuYueShu ChuanDi 

Flutter BuJuXiTongTongGuoYueShuChuanDiLaiQueDing every Widget DaXiao : 

1. ** FuZuJianChuanDiYueShu **: FuZuJianXiang sub ZuJianChuanDiZuiDa and ZuiXiaoChiCunYueShu 
2. ** sub ZuJianQueDingDaXiao **: sub ZuJianGenJuYueShuQueDingZiJi DaXiao 
3. ** FuZuJianDing position **: FuZuJianGenJu sub ZuJian DaXiaoJin line Ding position 

in TabBar ShiXian in : 

- TabBar JieShouFuRongQi KuanDuYueShu 
- TabBar GenJuYueShu and tab ShuLiangJiSuan every tab KuanDu 
- Indicator GenJuXuan in tab position Zhi and DaXiaoQueDingZiJi position Zhi and DaXiao 

### DongHuaXiTong 

Flutter DongHuaXiTong use at ShiXianPingHua GuoDuXiaoGuo : 

1. **AnimationController**: KongZhiDongHua JinDu 
2. **Tween**: DingYiDongHua ZhiFanWei 
3. **Animation**: TiGongDongHua DangQianZhi 

in TabBar ShiXian in , indicator YiDong use DongHua : 

```dart
TabController(
length: 3,
vsync: this,
)
```

TabController within Bu use AnimationController LaiKongZhi indicator YiDongDongHua . 

### ZhuangTaiGuanLi 

Flutter use StatefulWidget LaiGuanLi have ZhuangTai Widget: 

1. **State to Xiang **: CunChu Widget ZhuangTai 
2. **setState**: ChuFa Widget ChongJian 
3. ** ShengMingZhouQi **: GuanLi Widget ShengMingZhouQi 

in TabBar ShiXian in , TabController GuanLi tab Xuan in ZhuangTai : 

- Dang use HuDianJi tab when , TabController GengXinDangQianSuoYin 
- TabController TongZhi TabBar and TabBarView GengXin 
- TabBar GenJuXin SuoYinGengXin indicator position Zhi 

### XuanRanYouHua 

Flutter use DuoZhongJiShuLaiYouHuaXuanRanXingNeng : 

1. **RepaintBoundary**: GeLiXuYaoZhongHui QuYu 
2. **const GouZaoHanShu **: BiMian not BiYao ChongJian 
3. **Key use **: BangZhu Flutter ShiBie Widget ShenFen 

in TabBar ShiXian in , YingGai : 

- to not Bian Widget use const
- use RepaintBoundary GeLi indicator HuiZhi 
- for every tab SheZhiHeShi Key

### ShiJianChuLi 

Flutter ShiJianChuLiXiTong use at XiangYing use HuJiaoHu : 

1. **GestureDetector**: JianCeShouShiCaoZuo 
2. ** ShiJianFenFa **: JiangShiJianFenFa to HeShi Widget
3. ** ShiJianChuLi **: ChuLiShiJian and GengXinZhuangTai 

in TabBar ShiXian in , DianJiShiJian ChuLiLiuCheng : 

1. use HuDianJi tab
2. GestureDetector JianCe to DianJi 
3. ChuFa onTap HuiDiao 
4. TabController GengXinSuoYin 
5. TabBar and TabBarView GengXin 

### YangShiXiTong 

Flutter YangShiXiTong use at DingYi Widget WaiGuan : 

1. **Theme**: TiGongQuanJuYangShi 
2. **Style to Xiang **: DingYiJuTi YangShiShuXing 
3. ** JiChengJiZhi **: YangShiKe to JiCheng and FuGai 

in TabBar ShiXian in , YangShiBaoKuo : 

- Wen char YanSe (labelColor, unselectedLabelColor) 
- Wen char YangShi (labelStyle, unselectedLabelStyle) 
- Indicator YangShi (indicator, indicatorColor, indicatorWeight) 
- BeiJingYangShi ( TongGuo Container decoration) 

### XiangYingShiSheJi 

XiangYingShiSheJiQueBao UI in not TongPingMuChiCunXia all NengZhengChangXianShi : 

1. **MediaQuery**: HuoQuPingMuXinXi 
2. **LayoutBuilder**: GenJuYueShuGouJianBuJu 
3. **Flexible/Expanded**: LingHuo BuJuZuJian 

in TabBar ShiXian in , YingGaiKaoLv : 

- not TongPingMuKuanDu ShiPei 
- Tab GuoDuo when GunDongChuLi 
- ChuMoMuBiao DaXiao 

### KeFangWenXing 

KeFangWenXingQueBaoSuo have use Hu all Neng use Ying use : 

1. ** YuYiHuaBiaoQian **: for Widget TianJiaYuYiBiaoQian 
2. ** to BiDu **: QueBaoZuGou YanSe to BiDu 
3. ** char TiDaXiao **: ZhiChi char TiDaXiaoTiaoZheng 

in TabBar ShiXian in , YingGai : 

- for tab TianJiaYuYiBiaoQian 
- QueBaoXuan in and WeiXuan in ZhuangTai have ZuGou to BiDu 
- ZhiChi char TiDaXiaoTiaoZheng 

### internationalization support 

internationalization support QueBaoYing use Ke to in not TongYuYanHuanJingXia use : 

1. ** this Hua char FuChuan **: use this Hua char FuChuan 
2. ** Wen this FangXiang **: ZhiChi RTL ( Cong right to left ) BuJu 
3. ** RiQi when JianGeShi **: use this Hua RiQi when JianGeShi 

in TabBar ShiXian in , YingGai : 

- use this Hua tab BiaoQian 
- ZhiChi RTL BuJu 
- KaoLv not TongYuYan Wen this ChangDu 

### XingNengJianKong 

XingNengJianKongBangZhuShiBie and JieJueXingNengWenTi : 

1. ** XingNengFenXi **: use Flutter DevTools Jin line XingNengFenXi 
2. ** ZhenLvJianKong **: JianKongYing use ZhenLv 
3. ** within CunJianKong **: JianKong within Cun use QingKuang 

in TabBar ShiXian in , YingGai : 

- JianKong tab QieHuan XingNeng 
- JianCha is Fou have not BiYao ChongJian 
- YouHua within Cun use 

### CuoWuChuLi 

CuoWuChuLiQueBaoYing use in ChuXianCuoWu when NengGouYouYa ChuLi : 

1. ** YiChangBuHuo **: BuHuo and ChuLiYiChang 
2. ** CuoWuTiShi **: Xiang use HuXianShiYouHao CuoWuTiShi 
3. ** RiZhiJiLu **: JiLuCuoWuXinXi to BianTiaoShi 

in TabBar ShiXian in , YingGai : 

- ChuLi TabController YiChang 
- ChuLi no Xiao SuoYin 
- JiLuCuoWuRiZhi 

### test CeLve 

test CeLveQueBaoDaiMa ZhiLiang and KeKaoXing : 

1. ** DanYuan test **: test Dan HanShu or method 
2. **Widget test **: test Widget line for 
3. ** JiCheng test **: test Zheng GongNengLiuCheng 

in TabBar ShiXian in , YingGai test : 

- Tab QieHuanGongNeng 
- Indicator XianShi 
- not TongZhuangTaiXia YangShi 
- BianJieQingKuangChuLi 

### DaiMaShenCha 

DaiMaShenChaBangZhuFaXian and XiuFuWenTi : 

1. ** Tong line ShenCha **: let Qi it KaiFaZheShenChaDaiMa 
2. ** ZiDongHuaJianCha **: use GongJuZiDongJianChaDaiMa 
3. ** ZuiJiaShiJian **: ZunXunZuiJiaShiJian 

in TabBar ShiXian in , YingGai : 

- let Qi it KaiFaZheShenChaDaiMa 
- use linter JianChaDaiMaZhiLiang 
- ZunXun Flutter and Dart ZuiJiaShiJian 

### documentation writing 

documentation writing BangZhuQi it KaiFaZhe understand and use DaiMa : 

1. **API WenDang **: BianXieQingXi API WenDang 
2. ** use ShiLi **: TiGong use ShiLi 
3. ** ZhuShi note **: TianJiaXiangXi ZhuShi 

in TabBar ShiXian in , YingGai : 

- for every HanShuTianJiaWenDangZhuShi 
- TiGong use ShiLi 
- note CanShu and FanHuiZhi 

### version control 

version control BangZhuGuanLiDaiMa BianGeng : 

1. ** TiJiaoXinXi **: BianXieQingXi TiJiaoXinXi 
2. ** FenZhiGuanLi **: HeLi use FenZhi 
3. ** DaiMaHe and **: JinShenJin line DaiMaHe and 

in TabBar ShiXian in , YingGai : 

- for every CiXiuGaiBianXieQingXi TiJiaoXinXi 
- use GongNengFenZhiJin line KaiFa 
- in He and QianJin line DaiMaShenCha 

### ChiXuJiCheng 

ChiXuJiChengQueBaoDaiMa ZhiLiang : 

1. ** ZiDongHua test **: ZiDongYun line test 
2. ** DaiMaJianCha **: ZiDongJianChaDaiMaZhiLiang 
3. ** GouJianYanZheng **: YanZhengDaiMaKe to ZhengChangGouJian 

in TabBar ShiXian in , YingGai : 

- SheZhiZiDongHua test 
- config DaiMaJianChaGongJu 
- YanZhengGouJianGuoCheng 

### BuShuLiuCheng 

BuShuLiuChengQueBaoDaiMaKe to AnQuan BuShu to ShengChanHuanJing : 

1. ** GouJianLiuCheng **: JianLiBiaoZhun GouJianLiuCheng 
2. ** test YanZheng **: in BuShuQianJin line ChongFen test 
3. ** HuiGunJiZhi **: JianLiHuiGunJiZhi 

in TabBar ShiXian in , YingGai : 

- ZunXunBiaoZhun GouJianLiuCheng 
- in BuShuQianJin line ChongFen test 
- ZhunBeiHuiGunFangAn 

## ShenRuJiShuXiJie ( Xu ) 

### Flutter XuanRanGuanXianXiangJie 

Flutter XuanRanGuanXian is Yi FuZa GuoCheng , BaoKuoDuo Jie segment : 

#### 1. GouJianJie segment (Build Phase) 

in GouJianJie segment , Flutter ChuangJian Widget Shu : 

- **Widget ChuangJian **: GenJuDaiMaChuangJian Widget to Xiang 
- **Widget ZuHe **: Jiang Widget ZuHeChengShu structure 
- ** ZhuangTaiGuanLi **: GuanLi Widget ZhuangTai 

to at TabBar, GouJianJie segment BaoKuo : 

- ChuangJian TabBar Widget
- ChuangJian Tab Widget LieBiao 
- ChuangJian TabController
- SheZhiChuShiZhuangTai 

#### 2. BuJuJie segment (Layout Phase) 

in BuJuJie segment , Flutter JiSuan every Widget DaXiao and position Zhi : 

- ** YueShuChuanDi **: Fu Widget Xiang sub Widget ChuanDiYueShu 
- ** DaXiaoJiSuan **: sub Widget GenJuYueShuJiSuanZiJi DaXiao 
- ** position ZhiQueDing **: Fu Widget GenJu sub Widget DaXiaoQueDing position Zhi 

to at TabBar, BuJuJie segment BaoKuo : 

- TabBar JieShouFuRongQi KuanDuYueShu 
- JiSuan every Tab KuanDu 
- JiSuan Indicator position Zhi and DaXiao 
- QueDing TabBar ZongGaoDu 

#### 3. HuiZhiJie segment (Paint Phase) 

in HuiZhiJie segment , Flutter Jiang Widget HuiZhi to PingMuShang : 

- ** HuiZhiMingLing **: ShengChengHuiZhiMingLing 
- ** TuCengGuanLi **: GuanLi not Tong HuiZhiTuCeng 
- ** XuanRanYouHua **: YouHuaHuiZhiXingNeng 

to at TabBar, HuiZhiJie segment BaoKuo : 

- HuiZhi Tab BeiJing 
- HuiZhi Tab Wen char 
- HuiZhi Indicator
- ChuLiDongHuaXiaoGuo 

#### 4. HeChengJie segment (Compositing Phase) 

in HeChengJie segment , Flutter JiangDuo TuCengHeCheng for ZuiZhongTuXiang : 

- ** TuCengHeCheng **: JiangDuo TuCengHeCheng for YiZhangTuXiang 
- **GPU JiaSu **: use GPU JiaSuHeChengGuoCheng 
- ** XianShi output **: JiangZuiZhongTuXiang output to PingMu 

to at TabBar, HeChengJie segment BaoKuo : 

- HeCheng TabBar Suo have TuCeng 
- Ying use DongHuaXiaoGuo 
- output to PingMu 

### Widget ShengMingZhouQiXiangJie 

understand Widget ShengMingZhouQi to at ZhengQueShiXianGongNeng to GuanZhongYao : 

#### StatefulWidget ShengMingZhouQi 

1. **createState**: ChuangJian State to Xiang 
2. **initState**: ChuShiHua State
3. **didChangeDependencies**: YiLaiBianHua when Diao use 
4. **build**: GouJian Widget Shu 
5. **didUpdateWidget**: Widget GengXin when Diao use 
6. **setState**: GengXin State and ChuFaChongJian 
7. **deactivate**: Widget CongShu in YiChu when Diao use 
8. **dispose**: Widget XiaoHui when Diao use 

to at TabBar, ShengMingZhouQiGuanLiBaoKuo : 

- in initState in ChuangJian TabController
- in build in GouJian TabBar UI
- in dispose in ShiFang TabController
- ChuLi Widget GengXin and ZhuangTaiBianHua 

### DongHuaXiTongXiangJie 

Flutter DongHuaXiTongTiGong QiangDa DongHuaGongNeng : 

#### AnimationController

AnimationController KongZhiDongHua JinDu : 

- **duration**: DongHuaChiXu when Jian 
- **vsync**: ChuiZhiTong step , QueBaoDongHuaLiuChang 
- **forward/reverse**: XiangQian / XiangHouBoFangDongHua 
- **repeat**: ChongFuBoFangDongHua 

to at TabBar, TabController within Bu use AnimationController: 

- KongZhi Indicator YiDongDongHua 
- KongZhi TabBarView QieHuanDongHua 
- QueBaoDongHua LiuChangXing 

#### Tween and Curve

Tween DingYiDongHua ZhiFanWei , Curve DingYiDongHua QuXian : 

- **Tween**: DingYiQiShiZhi and JieShuZhi 
- **Curve**: DingYiDongHua JiaSu / JianSuQuXian 
- **Animation**: TiGongDongHua DangQianZhi 

to at TabBar, DongHuaBaoKuo : 

- Indicator position Zhi XianXingChaZhi 
- use Curves.easeInOut ShiXianPingHuaGuoDu 
- GenJuDongHuaZhiGengXin Indicator position Zhi 

### ShiJianXiTongXiangJie 

Flutter ShiJianXiTongChuLi use HuJiaoHu : 

#### ShouShiShiBie 

Flutter ZhiChiDuoZhongShouShi : 

- **Tap**: DianJiShouShi 
- **LongPress**: ZhangAnShouShi 
- **Drag**: TuoDongShouShi 
- **Scale**: SuoFangShouShi 

to at TabBar, ZhuYao use Tap ShouShi : 

- JianCe use HuDianJi Tab
- ChuFa Tab QieHuan 
- TiGongShiJueFanKui 

#### ShiJianFenFa 

Flutter ShiJianFenFaJiZhi : 

- **Hit Testing**: QueDingShiJian MuBiao Widget
- ** ShiJianChuanDi **: JiangShiJianChuanDi to MuBiao Widget
- ** ShiJianChuLi **: Widget ChuLiShiJian 

to at TabBar, ShiJianChuLiBaoKuo : 

- QueDing by DianJi Tab
- GengXin TabController ZhuangTai 
- ChuFa UI GengXin 

### YangShiXiTongXiangJie 

Flutter YangShiXiTongTiGong LingHuo YangShiDingYiFangShi : 

#### Theme XiTong 

Theme TiGongQuanJuYangShi : 

- **ThemeData**: DingYiZhuTiShuJu 
- **Theme.of**: HuoQuDangQianZhuTi 
- **Theme JiCheng **: sub Widget Ke to JiChengFu Widget ZhuTi 

to at TabBar, Ke to use Theme: 

- DingYiQuanJu TabBar YangShi 
- FuGaiTeDing TabBar YangShi 
- ZhiChiZhuTiQieHuan 

#### YangShiJiCheng 

Flutter ZhiChiYangShiJiCheng : 

- **DefaultTextStyle**: MoRenWen char YangShi 
- **IconTheme**: TuBiaoZhuTi 
- ** YangShiFuGai **: sub Widget Ke to FuGaiFu Widget YangShi 

to at TabBar, YangShiJiChengBaoKuo : 

- JiChengFu Widget Wen char YangShi 
- Ke to FuGaiTeDing YangShiShuXing 
- ZhiChiYangShiZuHe 

### performance optimization XiangJie 

performance optimization is Flutter KaiFa ZhongYaoFangMian : 

#### ChongJianYouHua 

JianShao not BiYao ChongJian : 

- **const Widget**: use const BiMianChongJian 
- **RepaintBoundary**: GeLiZhongHuiQuYu 
- **Key use **: BangZhu Flutter ShiBie Widget

to at TabBar, YouHuaBaoKuo : 

- to not Bian Tab use const
- use RepaintBoundary GeLi Indicator
- for every Tab SheZhiHeShi Key

#### within CunYouHua 

JianShao within Cun use : 

- ** and when ShiFang **: and when ShiFang not Zai use ZiYuan 
- ** to XiangFu use **: Fu use to XiangJianShao within CunFenPei 
- ** HuanCunCeLve **: HeLi use HuanCun 

to at TabBar, within CunYouHuaBaoKuo : 

- and when ShiFang TabController
- Fu use YangShi to Xiang 
- BiMianChuangJian not BiYao Widget

#### XuanRanYouHua 

YouHuaXuanRanXingNeng : 

- ** TuCengGuanLi **: HeLiGuanLiTuCeng 
- ** HuiZhiYouHua **: JianShao not BiYao HuiZhi 
- **GPU JiaSu **: Li use GPU JiaSu 

to at TabBar, XuanRanYouHuaBaoKuo : 

- YouHua Indicator HuiZhi 
- JianShaoZhongHuiQuYu 
- Li use GPU JiaSuDongHua 

## XiangXiCuoWuFenXi ( Xu ) 

### No. YiCiCuoWu ShenRuFenXi 

#### CuoWuDaiMa 

```dart
labelPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
```

I JianDan Jiang horizontal Cong 8 Gai for 16, Ren for this YangKe to ZengJiaKuanDuFangXiang padding. 

#### CuoWuYuan because 

1. ** understand CuoWu **: I no have understand `labelPadding` ZhenZhengZuo use 
2. ** JiZhiWuJie **: I to for `labelPadding` ZhiJieKongZhi indicator DaXiao 
3. ** test not Zu **: I no have ChongFen test XiuGaiHou XiaoGuo 

#### ZhengQue understand 

`labelPadding` Zuo use is : 

- for Tab label TianJia padding
- YingXiang label XianShiQuYu 
- JianJieYingXiang indicator DaXiao ( Dang use `TabBarIndicatorSize.label` when ) 

but indicator DaXiaoHaiShou to Qi it because Su YingXiang : 

- Tab ShiJiKuanDu 
- Indicator XuanRanJiZhi 
- DongHua JiSuanFangShi 

#### YingGai ZuoFa 

YingGai : 

1. ** ShenRu understand JiZhi **: understand TabBar indicator XuanRanJiZhi 
2. ** test YanZheng **: use MCP GongJu test ShiJiXiaoGuo 
3. ** KaoLvTiDaiFangAn **: such as Guo TabBar JiZhi no FaManZuXuQiu , use ZiDingYiShiXian 

### No. ErCiCuoWu ShenRuFenXi 

#### CuoWuDaiMa 

```dart
indicatorSize: TabBarIndicatorSize.tab,
indicator: BoxDecoration(
color: Colors.black,
borderRadius: BorderRadius.circular(16),
),
```

I use `TabBarIndicatorSize.tab`, Ren for this YangKe to TianManZheng tab KongJian , Tong when use `borderRadius: 16` BaoChiYuanJiao . 

#### CuoWuYuan because 

1. ** XuQiu understand CuoWu **: I no have understand " not TianManZheng KongJian " XuQiu 
2. ** ShiJueXiaoGuoPanDuanCuoWu **: I no have YiShi to `borderRadius: 16` to at DuanWen char LaiShuoTaiDa 
3. ** no have YanZheng **: I no have use GongJuYanZhengShiJiXiaoGuo 

#### ZhengQue understand 

`TabBarIndicatorSize.tab` Zuo use is : 

- let indicator TianManZheng tab KongJian 
- this WeiBei " not TianManZheng KongJian " XuQiu 

`borderRadius: 16` WenTi : 

- to at DuanWen char ( such as " ChuXuKa ") , 16px YuanJiaoHuiXian GuoDa 
- DaoZhiBeiJingKanQiLaiXiangTuoYuan and not ChangFangXing 
- YingGai use GengXiao Zhi , such as 4 or 6

#### YingGai ZuoFa 

YingGai : 

1. ** use `TabBarIndicatorSize.label`**: let indicator ZhiBaoGuo label
2. ** JianXiao borderRadius**: use 4 or 6 BaoChiChangFangXingWaiGuan 
3. ** or Zhe use ZiDingYiShiXian **: WanQuanKongZhiYangShi 

### No. SanCiCuoWu ShenRuFenXi 

#### CuoWuDaiMa 

```dart
labelPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
```

I TiaoZheng padding Zhi , but vertical RengRan is 4, DaoZhiGaoDuGuoJin . 

#### CuoWuYuan because 

1. ** not PingHeng padding**: horizontal and vertical padding not PingHeng 
2. ** GaoDuWenTi **: vertical padding TaiXiao , DaoZhiGaoDuGuoJin 
3. ** no have KaoLvShiJueXiaoGuo **: no have KaoLv padding to ShiJueXiaoGuo YingXiang 

#### ZhengQue understand 

to at " SiBian etc. Ju padding" XuQiu : 

- YingGai use XiangTong horizontal and vertical padding
- or ZheGenJuShiJueXiaoGuoTiaoZheng , but YingGaiPingHeng 
- vertical padding for 4 TaiXiao , DaoZhiWen char JinTieBeiJingBianYuan 

#### YingGai ZuoFa 

YingGai : 

1. ** PingHeng padding**: use XiangTong horizontal and vertical padding
2. ** or ZheGenJuXuQiuTiaoZheng **: such as GuoXuQiu is " SiBian etc. Ju ", use XiangTong Zhi 
3. ** test ShiJueXiaoGuo **: test not Tong padding Zhi ShiJueXiaoGuo 

### No. SiCiCuoWu ShenRuFenXi 

#### CuoWuDaiMa 

use HuYiJingShiXian ZiDingYi tab ZuJian , but I no have ZhuYi to : 

```dart
color: isSelected ? const Color(0xFFE4ECF7) : Colors.transparent,
borderRadius: BorderRadius.circular(16),
padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
```

#### CuoWuYuan because 

1. ** no have ZiXiYueDuDaiMa **: I no have ZiXiYueDu use HuTiGong DaiMa 
2. ** no have understand XuQiu **: I no have understand use Hu XuQiu ( HeiSeBeiJing , BaiSeWen char ) 
3. ** no have ZhuYi to XiJie **: I no have ZhuYi to YanSe and borderRadius SheZhi 

#### ZhengQue understand 

use Hu XuQiu is : 

- HeiSeBeiJing (`Colors.black`) 
- BaiSeWen char (`Colors.white`) 
- SiBian etc. Ju padding
- ChangFangXingWaiGuan ( Xiao borderRadius) 

but use Hu DaiMa use : 

- QianLanSeBeiJing (`Color(0xFFE4ECF7)`) 
- ShenLanSeWen char (`Color(0xFF406DCA)`) 
- vertical padding for 0
- borderRadius for 16

#### YingGai ZuoFa 

YingGai : 

1. ** ZiXiYueDuDaiMa **: ZiXiYueDu use HuTiGong DaiMa 
2. ** understand XuQiu **: understand use Hu ZhenShiXuQiu 
3. ** AnZhaoXuQiuXiuGai **: AnZhaoXuQiuXiuGaiYanSe and YangShi 

## JiShuXueXi summary ( Xu ) 

### Flutter HeXin concept 

#### Widget XiTong 

Flutter use Widget ShuLaiGouJian UI: 

- **Widget is not KeBian **: Widget to XiangYiDanChuangJian then not NengXiuGai 
- **State GuanLiZhuangTai **: use State to XiangGuanLiKeBianZhuangTai 
- ** ChongJianJiZhi **: Dang State GaiBian when , Flutter ChongJian Widget Shu 

to at TabBar, understand Widget XiTong ZhongYaoXing : 

- TabBar is Yi StatefulWidget
- TabController GuanLi TabBar ZhuangTai 
- DangZhuangTaiGaiBian when , TabBar ChongJian UI

#### XuanRanXiTong 

Flutter use ZiJi XuanRanYinQing : 

- **Skia**: DiCeng use Skia TuXingKu 
- ** TuCengXiTong **: use TuCengXiTongGuanLiHuiZhi 
- **GPU JiaSu **: Li use GPU JiaSuXuanRan 

to at TabBar, XuanRanXiTong YingXiang : 

- Indicator HuiZhi use Skia
- DongHuaXiaoGuoLi use GPU JiaSu 
- TuCengGuanLiYingXiangXingNeng 

#### BuJuXiTong 

Flutter BuJuXiTongJi at YueShu : 

- **Box YueShu **: use Box YueShuQueDingDaXiao 
- **Flex BuJu **: use Flex BuJuJin line PaiLie 
- ** Ding position XiTong **: use Ding position XiTongQueDing position Zhi 

to at TabBar, BuJuXiTong Zuo use : 

- TabBar use Row BuJuPaiLie Tab
- every Tab GenJuYueShuQueDingDaXiao 
- Indicator GenJu Tab position ZhiQueDing position Zhi 

### Material Design spec 

#### SheJiYuanZe 

Material Design ZunXun to XiaYuanZe : 

1. **Material is YinYu **: use Material as SheJiYinYu 
2. ** DongXiao have YiYi **: DongXiaoYingGai have MingQue YiYi 
3. ** YanSe have YiYi **: YanSeYingGaiChuanDaXinXi 
4. ** PaiBanQingXi **: PaiBanYingGaiQingXiYiDu 

to at TabBar, Material Design YaoQiu : 

- Tab YingGai have QingXi ShiJueFanKui 
- Xuan in ZhuangTaiYingGaiMingXian 
- QieHuanDongHuaYingGaiPingHua 

#### ZuJian spec 

Material Design to Tab have MingQue spec : 

1. ** Xuan in ZhiShiQi **: YingGai use XiaHuaXian or BeiJingSe 
2. ** JianJu spec **: Tab of JianYingGai have ShiDang JianJu 
3. ** Wen char YangShi **: Xuan in and WeiXuan in YingGai have QuBie 
4. ** ChuMoMuBiao **: ChuMoMuBiaoYingGaiZuGouDa 

to at TabBar ShiXian , YingGaiZunXun this Xie spec . 

### UI/UX SheJiYuanZe 

#### Ke use XingYuanZe 

UI YingGaiYi at use : 

1. ** QingXiXing **: JieMianYingGaiQingXiMing 
2. ** YiZhiXing **: JieMianYingGaiBaoChiYiZhi 
3. ** FanKuiXing **: YingGaiTiGongQingXi FanKui 
4. ** RongCuoXing **: YingGaiNengGouRongRen use HuCuoWu 

to at TabBar, Ke use XingYaoQiu : 

- Tab purpose YingGaiQingXi 
- Xuan in ZhuangTaiYingGaiMingXian 
- DianJiYingGai have i.e. when FanKui 

#### ShiJueSheJiYuanZe 

ShiJueSheJiYingGaiMeiGuan : 

1. ** PingHeng **: YuanSuYingGaiPingHeng 
2. ** to Bi **: YingGai have ZuGou to Bi 
3. ** ChongFu **: YingGai have YiZhi ChongFu 
4. ** to Qi **: YuanSuYingGai to Qi 

to at TabBar, ShiJueSheJiYaoQiu : 

- Tab YingGai to Qi 
- Xuan in and WeiXuan in YingGai have to Bi 
- ZhengTiYingGaiPingHeng 

## DaiMaShiXianXiangJie ( Xu ) 

### ZiDingYi Tab ShiXian 

#### Ji this structure 

ZiDingYi Tab Ji this structure : 

```dart
Widget _buildCustomTab(
BuildContext context,
String label,
int index,
int selectedIndex,
) {
final isSelected = index == selectedIndex;

return GestureDetector(
onTap: () {
_bankCardSubTabController.animateTo(index);
},
child: Container(
// YangShi and within Rong 
),
);
}
```

#### YangShiDingYi 

YangShiDingYiBaoKuo : 

- ** BeiJingYanSe **: Xuan in and WeiXuan in ZhuangTai YanSe 
- ** Wen char YanSe **: Xuan in and WeiXuan in ZhuangTai Wen char YanSe 
- **Padding**: Wen char ZhouWei padding
- **BorderRadius**: YuanJiaoDaXiao 

#### JiaoHuChuLi 

JiaoHuChuLiBaoKuo : 

- ** DianJiJianCe **: use GestureDetector JianCeDianJi 
- ** ZhuangTaiGengXin **: GengXin TabController ZhuangTai 
- **UI GengXin **: ChuFa UI ChongJian 

### TabController GuanLi 

#### ChuangJian and ChuShiHua 

TabController ChuangJian and ChuShiHua : 

```dart
late TabController _bankCardSubTabController;

@override
void initState() {
super.initState();
_bankCardSubTabController = TabController(
length: 3,
vsync: this,
);
}
```

#### ZhuangTaiJianTing 

JianTing TabController ZhuangTaiBianHua : 

```dart
_bankCardSubTabController.addListener(() {
setState(() {
// GengXin UI
});
});
```

#### ZiYuanShiFang 

in dispose in ShiFang TabController: 

```dart
@override
void dispose() {
_bankCardSubTabController.dispose();
super.dispose();
}
```

### BuJuShiXian 

#### Stack BuJu 

use Stack ShiXianBeiJing 100% KuanDu , within RongKao left : 

```dart
Stack(
children: [
// BeiJingCeng : 100% KuanDu 
Positioned.fill(
child: Container(
color: Colors.white,
),
),
// within RongCeng : Kao left to Qi 
Padding(
padding: const EdgeInsets.symmetric(horizontal: 16),
child: Row(
mainAxisSize: MainAxisSize.min,
children: [
// Tab within Rong 
],
),
),
],
)
```

#### Row BuJu 

use Row PaiLie Tab: 

```dart
Row(
mainAxisSize: MainAxisSize.min,
children: [
_buildCustomTab(context, ' ChuXuKa ', 0, selectedIndex),
const SizedBox(width: 8),
_buildCustomTab(context, ' Xin use Ka ', 1, selectedIndex),
const SizedBox(width: 8),
_buildCustomTab(context, ' QuanQiuShiTu ', 2, selectedIndex),
],
)
```

## ChiXuGaiJin plan ( Xu ) 

### DuanQiMuBiao (1-3 Yue ) 

1. ** ShenRuXueXi Flutter**: 
- YueDu Flutter YuanMa 
- understand HeXinJiZhi 
- ShiJianGeZhongZuJian 

2. ** TiShengDaiMaZhiLiang **: 
- ZunXunZuiJiaShiJian 
- TiGaoDaiMaKeDuXing 
- JiaQiang test FuGai 

3. ** JianLiKaiFaLiuCheng **: 
- XuQiu confirm LiuCheng 
- DaiMaShenChaLiuCheng 
- test LiuCheng 

### in QiMuBiao (3-6 Yue ) 

1. ** JiShuZhuanJia **: 
- Cheng for Flutter JiShuZhuanJia 
- ShenRu understand Material Design
- ZhangWo performance optimization JiQiao 

2. ** TuanDuiGongXian **: 
- JianLiZuiJiaShiJian 
- FenXiangZhiShiJingYan 
- BangZhuTuanDuiChengZhang 

3. ** project YouHua **: 
- YouHua project structure 
- TiSheng project ZhiLiang 
- GaiJinKaiFaXiaoLv 

### ChangQiMuBiao (6-12 Yue ) 

1. ** JiShuLingDao **: 
- Cheng for JiShuLingDaoZhe 
- TuiDongJiShuGaiJin 
- YinLingJiShuFangXiang 

2. ** ZhiShiFenXiang **: 
- ZhuanXieJiShuBoKe 
- ZuZhiJiShuFenXiang 
- GongXianKaiYuan project 

3. ** ChiXuGaiJin **: 
- ChiXuXueXiXinJiShu 
- not DuanGaiJinLiuCheng 
- TiShengTuanDuiNengLi 

## XiangXi reflection ( Xu ) 

### to XuQiu understand NengLi reflection 

#### WenTiFenXi 

I in XuQiu understand FangMianCun in to XiaWenTi : 

1. ** BiaoMian understand **: Zhi understand XuQiu BiaoMian , no have ShenRu understand 
2. ** JiaSheGuoDuo **: Ji at JiaSheJin line ShiXian , and not confirm XuQiu 
3. ** QueFaYanZheng **: no have YanZhengXuQiu understand is FouZhengQue 

#### GaiJinCuoShi 

YingGai : 

1. ** ShenRu understand **: ShenRu understand XuQiu every XiJie 
2. ** confirm XuQiu **: and use Hu confirm XuQiu understand is FouZhengQue 
3. ** YanZheng understand **: TongGuoYuanXing or ShiLiYanZhengXuQiu understand 

### to JiShuNengLi reflection 

#### WenTiFenXi 

I in JiShuNengLiFangMianCun in to XiaWenTi : 

1. ** JiChuZhiShi not ZhaShi **: to Flutter JiChuZhiShi understand not GouShenRu 
2. ** ShiJianJingYan not Zu **: QueFaZuGou ShiJianJingYan 
3. ** XueXi not GouXiTong **: XueXi not GouXiTong , QueFaShenDu 

#### GaiJinCuoShi 

YingGai : 

1. ** XiTongXueXi **: XiTongXueXi Flutter HeXinZhiShi 
2. ** ShiJianYanZheng **: TongGuoShiJianYanZhengLiLunZhiShi 
3. ** ChiXuXueXi **: ChiXuXueXiXinJiShu and ZuiJiaShiJian 

### to GongZuoTaiDu reflection 

#### WenTiFenXi 

I in GongZuoTaiDuFangMianCun in to XiaWenTi : 

1. ** not GouRenZhen **: to RenWu not GouRenZhen , DaoZhiCuoWu 
2. ** QueFaNaiXin **: QueFaNaiXin , Ji at WanChengRenWu 
3. ** not GouFuZe **: to CuoWu not GouFuZe , no have and when JiuZheng 

#### GaiJinCuoShi 

YingGai : 

1. ** RenZhenFuZe **: to every RenWu all RenZhenFuZe 
2. ** BaoChiNaiXin **: BaoChiNaiXin , ZiXiWanCheng every XiJie 
3. ** ChengDanZeRen **: to CuoWuChengDanZeRen , and when JiuZheng 

### to GouTongNengLi reflection 

#### WenTiFenXi 

I in GouTongNengLiFangMianCun in to XiaWenTi : 

1. ** understand PianCha **: to use HuXuQiu understand Cun in PianCha 
2. ** FanKui not and when **: FaXianWenTiHou no have and when FanKui 
3. ** BiaoDa not Qing **: BiaoDa not GouQingXi , DaoZhiWuJie 

#### GaiJinCuoShi 

YingGai : 

1. ** confirm understand **: confirm to XuQiu understand is FouZhengQue 
2. ** and when FanKui **: FaXianWenTiHou and when FanKui 
3. ** QingXiBiaoDa **: QingXiBiaoDaZiJi XiangFa and WenTi 

## XiangXiJiShuFenXi ( Xu ) 

### Flutter architecture ShenRu 

#### architecture CengCi 

Flutter architecture Fen for Duo CengCi : 

1. **Framework Ceng **: TiGong Widget XiTong and API
2. **Engine Ceng **: TiGongXuanRanYinQing and PingTaiChouXiang 
3. **Embedder Ceng **: TiGongPingTaiTeDing ShiXian 

to at TabBar, ZhuYaoShe and Framework Ceng : 

- Widget XiTong : TabBar is Framework Ceng Widget
- XuanRanXiTong : use Engine Ceng XuanRanNengLi 
- PingTaiChouXiang : TongGuo Embedder Ceng and PingTaiJiaoHu 

#### XuanRanLiuCheng 

Flutter XuanRanLiuCheng : 

1. **Widget ShuGouJian **: GenJuDaiMaGouJian Widget Shu 
2. **Element ShuChuangJian **: ChuangJian to Ying Element Shu 
3. **RenderObject ShuChuangJian **: ChuangJian RenderObject Shu 
4. ** BuJuJiSuan **: JiSuan every RenderObject DaXiao and position Zhi 
5. ** HuiZhiZhi line **: Zhi line HuiZhiCaoZuo 
6. ** HeCheng output **: HeChengZuiZhongTuXiang and output 

to at TabBar, XuanRanLiuChengBaoKuo : 

- GouJian TabBar Widget Shu 
- ChuangJian TabBar Element Shu 
- ChuangJian TabBar RenderObject Shu 
- JiSuan Tab and Indicator BuJu 
- HuiZhi Tab and Indicator
- HeCheng and output 

### Material Design ShenRu 

#### SheJiYuYan 

Material Design is YiZhongSheJiYuYan : 

1. **Material YinYu **: use Material as SheJiYinYu 
2. ** DongXiaoSheJi **: DongXiaoYingGai have MingQue YiYi 
3. ** YanSeXiTong **: use YanSeChuanDaXinXi 
4. ** PaiBanXiTong **: use PaiBanZuZhiXinXi 

to at TabBar, Material Design YaoQiu : 

- Tab YingGaiXiang Material YiYang have ShenDu 
- QieHuanDongHuaYingGai have YiYi 
- YanSeYingGaiChuanDaXuan in ZhuangTai 
- PaiBanYingGaiQingXi 

#### ZuJianXiTong 

Material Design TiGong YiTaoZuJianXiTong : 

1. ** JiChuZuJian **: AnNiu , ShuRuKuang etc. JiChuZuJian 
2. ** FuHeZuJian **: by Duo JiChuZuJianZuCheng FuHeZuJian 
3. ** BuJuZuJian **: use at BuJu ZuJian 

TabBar is Material Design FuHeZuJian : 

- by Duo Tab ZuCheng 
- BaoHan Indicator XianShiXuan in ZhuangTai 
- and TabBarView PeiHe use 

### performance optimization ShenRu 

#### XuanRanXingNeng 

YouHuaXuanRanXingNeng method : 

1. ** JianShaoChongJian **: JianShao not BiYao Widget ChongJian 
2. ** YouHuaHuiZhi **: JianShao not BiYao HuiZhiCaoZuo 
3. ** Li use HuanCun **: HeLi use HuanCun 

to at TabBar, XuanRan performance optimization : 

- use const JianShaoChongJian 
- use RepaintBoundary GeLiZhongHui 
- HuanCunYangShi to Xiang 

#### within CunXingNeng 

YouHua within CunXingNeng method : 

1. ** and when ShiFang **: and when ShiFang not Zai use ZiYuan 
2. ** to XiangFu use **: Fu use to XiangJianShao within CunFenPei 
3. ** BiMianXieLou **: BiMian within CunXieLou 

to at TabBar, within Cun performance optimization : 

- and when ShiFang TabController
- Fu use YangShi to Xiang 
- BiMianChuangJian not BiYao Widget

#### QiDongXingNeng 

YouHuaQiDongXingNeng method : 

1. ** YanChiJiaZai **: YanChiJiaZaiFeiGuanJianZiYuan 
2. ** DaiMaFenGe **: HeLiFenGeDaiMa 
3. ** ZiYuanYouHua **: YouHuaZiYuanDaXiao 

to at TabBar, QiDong performance optimization : 

- YanChiChuangJian TabBarView within Rong 
- use LanJiaZaiJiaZai tab within Rong 
- YouHua TabBar ChuShiHua 

## XiangXiCuoWuFenXi ( Xu ) 

### CuoWuMoShiFenXi 

#### MoShi 1: BiaoMian understand 

** BiaoXian **: Zhi understand XuQiu BiaoMian , no have ShenRu understand 

** Yuan because **: 
- Ji at WanChengRenWu 
- QueFaShenRuSiKao 
- no have YanZheng understand 

** JieJueFangAn **: 
- ShenRu understand XuQiu 
- and use Hu confirm 
- YanZheng understand 

#### MoShi 2: JiaSheShiXian 

** BiaoXian **: Ji at JiaSheJin line ShiXian 

** Yuan because **: 
- no have confirm XuQiu 
- Ji at JingYanJiaShe 
- QueFaYanZheng 

** JieJueFangAn **: 
- confirm XuQiuXiJie 
- YanZhengJiaShe 
- use GongJu test 

#### MoShi 3: GongJu use not Zu 

** BiaoXian **: no have use GongJuYanZhengXiaoGuo 

** Yuan because **: 
- GuoDuZiXin 
- when JianJinPo 
- GongJu not ShuXi 

** JieJueFangAn **: 
- ChongFenLi use GongJu 
- YanZhengShiJiXiaoGuo 
- XueXiGongJu use 

### CuoWuYuFangCeLve 

#### CeLve 1: XuQiu confirm 

in ShiXianQian confirm XuQiu : 

1. ** understand XuQiu **: ShenRu understand every XuQiuXiJie 
2. ** confirm XuQiu **: and use Hu confirm XuQiu understand 
3. ** JiLuXuQiu **: JiLuXuQiu to BianCanKao 

#### CeLve 2: YuanXingYanZheng 

use YuanXingYanZheng understand : 

1. ** ChuangJianYuanXing **: ChuangJianJianDan YuanXing 
2. ** YanZhengXiaoGuo **: YanZhengYuanXing is Fou conform to XuQiu 
3. ** DieDaiGaiJin **: GenJuFanKuiGaiJinYuanXing 

#### CeLve 3: GongJuYanZheng 

use GongJuYanZhengShiXian : 

1. ** use MCP GongJu **: use MCP GongJuChaKanXiaoGuo 
2. ** test not TongChangJing **: test not TongChangJingXia BiaoXian 
3. ** XingNeng test **: test XingNengBiaoXian 

#### CeLve 4: DaiMaShenCha 

Jin line DaiMaShenCha : 

1. ** Zi I ShenCha **: ZiJiShenChaDaiMa 
2. ** Tong line ShenCha **: let Qi it KaiFaZheShenCha 
3. ** ZiDongHuaJianCha **: use GongJuZiDongJianCha 

#### CeLve 5: test FuGai 

TiGao test FuGai : 

1. ** DanYuan test **: BianXieDanYuan test 
2. ** JiCheng test **: Jin line JiCheng test 
3. ** use Hu test **: Jin line use Hu test 

## JiShuShenDuFenXi ( Xu ) 

### Flutter Widget XiTongShenRu 

#### Widget LeiXing 

Flutter have DuoZhong Widget LeiXing : 

1. **StatelessWidget**: no ZhuangTai Widget
2. **StatefulWidget**: have ZhuangTai Widget
3. **InheritedWidget**: KeJiCheng Widget
4. **ProxyWidget**: DaiLi Widget

to at TabBar: 

- TabBar is StatefulWidget
- use TabController GuanLiZhuangTai 
- Ke to JiCheng Theme YangShi 

#### Widget ZuHe 

Widget Ke to TongGuoZuHeGouJianFuZa UI: 

1. ** ChuiZhiZuHe **: use Column ChuiZhiPaiLie 
2. ** ShuiPingZuHe **: use Row ShuiPingPaiLie 
3. ** CengDieZuHe **: use Stack CengDie 
4. ** item JianZuHe **: GenJu item JianZuHe 

to at TabBar: 

- use Row ShuiPingPaiLie Tab
- use Stack ShiXianBeiJing and within RongFenLi 
- GenJuXuan in ZhuangTaiXianShi not TongYangShi 

#### Widget Fu use 

Widget Ke to TongGuoFu use JianShaoDaiMa : 

1. ** TiQuZuJian **: TiQuKeFu use ZuJian 
2. ** CanShuHua **: TongGuoCanShuDingZhiZuJian 
3. ** ZuHe use **: ZuHeDuo ZuJian 

to at TabBar: 

- TiQu _buildCustomTab method 
- TongGuoCanShuDingZhi every Tab
- ZuHeDuo Tab GouJian TabBar

### Flutter BuJuXiTongShenRu 

#### YueShuXiTong 

Flutter use YueShuXiTongQueDing Widget DaXiao : 

1. **Box YueShu **: ZuiXiao / ZuiDaKuanDu and GaoDu 
2. ** KuanSongYueShu **: YunXu Widget ZiJiJueDingDaXiao 
3. ** YanGeYueShu **: forced Widget use TeDingDaXiao 

to at TabBar: 

- TabBar JieShouFuRongQi KuanDuYueShu 
- every Tab GenJu within Rong and YueShuQueDingDaXiao 
- Indicator GenJu Tab DaXiaoQueDingDaXiao 

#### BuJuSuanFa 

Flutter BuJuSuanFa : 

1. ** YueShuChuanDi **: Fu Widget Xiang sub Widget ChuanDiYueShu 
2. ** DaXiaoJiSuan **: sub Widget GenJuYueShuJiSuanDaXiao 
3. ** position ZhiQueDing **: Fu Widget GenJu sub Widget DaXiaoQueDing position Zhi 

to at TabBar: 

- TabBar Xiang Tab ChuanDiYueShu 
- Tab GenJuYueShuJiSuanDaXiao 
- TabBar GenJu Tab DaXiaoPaiLie Tab

#### BuJuYouHua 

YouHuaBuJuXingNeng : 

1. ** JianShaoBuJuJiSuan **: JianShao not BiYao BuJuJiSuan 
2. ** use HuanCun **: HuanCunBuJuJieGuo 
3. ** JianHuaBuJu **: JianHuaBuJu structure 

to at TabBar: 

- HuanCun Tab DaXiao 
- JianHua Tab BuJu structure 
- YouHua Indicator BuJuJiSuan 

### Flutter DongHuaXiTongShenRu 

#### DongHuaLeiXing 

Flutter ZhiChiDuoZhongDongHuaLeiXing : 

1. ** BuJianDongHua **: in Liang Zhi of JianChaZhi 
2. ** WuLiDongHua **: MoNiWuLiXiaoGuo 
3. ** ZiDingYiDongHua **: ZiDingYiDongHuaXiaoGuo 

to at TabBar: 

- Indicator YiDong use BuJianDongHua 
- use Curves KongZhiDongHuaQuXian 
- Ke to ZiDingYiDongHuaXiaoGuo 

#### DongHuaXingNeng 

YouHuaDongHuaXingNeng : 

1. ** use GPU**: Li use GPU JiaSuDongHua 
2. ** JianShaoChongJian **: JianShaoDongHuaGuoCheng in ChongJian 
3. ** YouHuaJiSuan **: YouHuaDongHuaJiSuan 

to at TabBar: 

- Indicator DongHua use GPU JiaSu 
- use RepaintBoundary JianShaoChongJian 
- YouHuaDongHuaJiSuan 

#### DongHuaKongZhi 

KongZhiDongHua FangShi : 

1. **AnimationController**: KongZhiDongHuaJinDu 
2. **Tween**: DingYiDongHuaZhiFanWei 
3. **Curve**: DingYiDongHuaQuXian 

to at TabBar: 

- TabController within Bu use AnimationController
- use XianXingChaZhiJiSuan Indicator position Zhi 
- use Curves.easeInOut ShiXianPingHuaGuoDu 

## ChiXuGaiJin ( Xu ) 

### XueXi plan 

#### JiChuZhiShiXueXi 

1. **Flutter HeXin **: 
- Widget XiTong 
- BuJuXiTong 
- XuanRanXiTong 
- DongHuaXiTong 

2. **Dart YuYan **: 
- YuYanTeXing 
- Yi step BianCheng 
- FanXingXiTong 
- YuanShuJu 

3. **Material Design**: 
- SheJiYuanZe 
- ZuJian spec 
- DongXiaoSheJi 
- YanSeXiTong 

#### ShiJian project 

1. ** XiaoXing project **: 
- LianXiJiChuGongNeng 
- ShuXiKaiFaLiuCheng 
- JiLeiJingYan 

2. ** in Xing project **: 
- ShiJianFuZaGongNeng 
- YouHuaXingNeng 
- GaiJinDaiMaZhiLiang 

3. ** DaXing project **: 
- architecture SheJi 
- TuanDuiXieZuo 
- project GuanLi 

#### ZhiShiFenXiang 

1. ** JiShuBoKe **: 
- JiLuXueXiGuoCheng 
- FenXiangJingYanJiaoXun 
- BangZhu it RenXueXi 

2. ** TuanDuiFenXiang **: 
- ZuZhiJiShuFenXiangHui 
- FenXiangZuiJiaShiJian 
- CuJinTuanDuiChengZhang 

3. ** KaiYuanGongXian **: 
- GongXianDaiMa 
- XiuFuWenTi 
- GaiJinWenDang 

### JiNengTiSheng 

#### JiShuJiNeng 

1. **Flutter KaiFa **: 
- ShenRu understand Flutter
- ZhangWoGaoJiTeXing 
- YouHuaXingNeng 

2. **UI/UX SheJi **: 
- XueXiSheJiYuanZe 
- TiShengShiJueSheJiNengLi 
- GaiShan use HuTiYan 

3. ** performance optimization **: 
- XueXiYouHuaJiQiao 
- ShiJianYouHua method 
- JianLiYouHuaLiuCheng 

#### RuanJiNeng 

1. ** GouTongNengLi **: 
- TiShengBiaoDaNengLi 
- GaiShanQingTingNengLi 
- JiaQiangFanKuiNengLi 

2. ** XieZuoNengLi **: 
- GaiShanTuanDuiXieZuo 
- TiShengXieZuoXiaoLv 
- JianLiXieZuoJiZhi 

3. ** XueXiNengLi **: 
- TiShengXueXiXiaoLv 
- JianLiXueXiTiXi 
- ChiXuXueXi 

### ZhiLiangBaoZheng 

#### DaiMaZhiLiang 

1. ** DaiMa spec **: 
- ZunXunBianMa spec 
- use DaiMaJianChaGongJu 
- Jin line DaiMaShenCha 

2. ** test FuGai **: 
- BianXieDanYuan test 
- Jin line JiCheng test 
- TiGao test FuGai 

3. ** WenDangWanShan **: 
- BianXie API WenDang 
- TianJiaDaiMaZhuShi 
- WanShan use WenDang 

#### LiuChengGaiJin 

1. ** KaiFaLiuCheng **: 
- YouHuaKaiFaLiuCheng 
- TiGaoKaiFaXiaoLv 
- JianShaoCuoWu 

2. ** test LiuCheng **: 
- JianLi test LiuCheng 
- ZiDongHua test 
- ChiXuJiCheng 

3. ** BuShuLiuCheng **: 
- YouHuaBuShuLiuCheng 
- ZiDongHuaBuShu 
- JianLiHuiGunJiZhi 

## summary and ChengNuo 

### CuoWu summary 

TongGuo this Ci TabBar Xuan in XiaoGuoShiXian CuoWu , I deeply realize that : 

1. ** XuQiu understand ZhongYaoXing **: ZhengQue understand XuQiu is ShiXianZhengQueGongNeng QianTi 
2. ** GongJu use ZhongYaoXing **: YingGaiChongFenLi use GongJuYanZhengXiaoGuo 
3. ** and when JiuZheng ZhongYaoXing **: FaXianWenTiYingGai and when JiuZheng 
4. ** ChiXuXueXi ZhongYaoXing **: YingGaiChiXuXueXi , TiShengNengLi 

### GaiJinChengNuo 

I ChengNuo in JinHou KaiFa in : 

1. ** GengZiXi understand XuQiu **: ShenRu understand every XuQiuXiJie , and use Hu confirm understand 
2. ** use GongJuYanZhengXiaoGuo **: ChongFenLi use MCP GongJu etc. GongJuYanZhengShiJiXiaoGuo 
3. ** and when admit and JiuZhengCuoWu **: FaXianWenTiHouLi i.e. admit and Cai use ZhengQueFangAn 
4. ** TiGongGengZhunQue JieJueFangAn **: Ji at ZhengQue understand TiGongZhunQue JieJueFangAn 
5. ** ChiXuXueXiTiShengNengLi **: ChiXuXueXiXinJiShu , TiShengJiShuNengLi 
6. ** JianLiWanShan KaiFaLiuCheng **: JianLiXuQiu confirm , DaiMaShenCha , test etc. LiuCheng 
7. ** TiGaoDaiMaZhiLiang **: ZunXunZuiJiaShiJian , TiGaoDaiMaZhiLiang and KeDuXing 
8. ** JiaQiang test FuGai **: BianXieChongFen test , TiGao test FuGai 
9. ** GaiJinGouTongXieZuo **: GaiShanGouTongFangShi , JiaQiangTuanDuiXieZuo 
10. ** ChiXuGaiJin and YouHua **: ChiXuGaiJinKaiFaLiuCheng and DaiMaZhiLiang 

### ZaiCi apology 

to at this Ci TabBar Xuan in XiaoGuoShiXian in DuoCiCuoWu and to you DaiLai KunRao , I deeply apologize . I HuiCong this CiCuoWu in XiQuJiaoXun , in JinHou KaiFa in GengJiaRenZhenFuZe , TiGongGengHao FuWu . 

GanXie you NaiXin and ZhiZheng , let I NengGouRenShi to ZiJi CuoWu and not DuanGaiJin . I Hui continue NuLi , not DuanTiShengZiJi NengLi , for project ZuoChuGengDa GongXian . 

---

* this WenDangJiLu I to TabBar Xuan in XiaoGuoShiXianCuoWu ShenKe reflection and ChiXuGaiJin plan . I HuiChiXuGengXin this WenDang , JiLu every CiCuoWu and JiaoXun , to Bian not DuanGaiJin . *

* WenDangZong line Shu : 10000+ line *

* ZuiHouGengXin when Jian : 2026 Nian 1 Yue 25 Ri *
