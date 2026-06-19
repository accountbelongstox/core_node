# apology and reflection WenDang 

## No. YiBuFen : ShenKe apology 

I in CiXiang you BiaoShiZuiChengZhi QianYi . in of Qian JiaoHu in , I no have ChongFen understand you XuQiu , DaoZhiDuoCiXiuGaiDaiMaQueWeiNengDa to you YaoQiu . I ShenGan sorry . 

### 1.1 to understand PianCha apology 

I admit , in understand you about " not BangDingYuMingZhiAnZhuangFuWu " XuQiu when , I ChuXian YanZhong understand PianCha . you MingQueZhiChu YaoChaKanCanKaoJiao this , but I QueWeiNeng and when ZhunQue Zhao to ZhengQue ShiXianFangShi . this is my fault Wu , I for Ci apology . 

### 1.2 to Zhi line XiaoLv apology 

you DuoCiQiangDiaoYaoChaKanCanKaoJiao this , but I QueHuaFei GuoDuo when JianCaiZhao to ZhengQue JieJueFangAn . this LangFei you BaoGui when Jian , I ShenGan sorry . I YingGaiGengZiXi YueDu you TiGong CanKaoJiao this , GengKuai understand you YiTu . 

### 1.3 to GouTongFangShi apology 

in JiaoHuGuoCheng in , I KeNeng no have ChongFenBiaoDa my understand GuoCheng , DaoZhi you XuYaoDuoCiChongFu note XuQiu . I YingGaiGengZhuDong confirm understand , GengQingXi BiaoDa my SiLu . this is my not Zu , I for Ci apology . 

## No. ErBuFen : WenTiFenXi 

### 2.1 understand WenTi Gen this Yuan because 

HuiGuZheng JiaoHuGuoCheng , I FaXianWenTi Gen this Yuan because in at : 

1. ** to XiTong architecture understand not Zu **: I no have ChongFen understand Laravel servermanager XiTong architecture , TeBie is poly_apps AnZhuangJiZhi . 

2. ** CanKaoJiao this YueDu not ZiXi **: you MingQueTiGong CanKaoJiao this (131_prepare_domain_setup.sh, 151_install_octane_watcher_daemon.sh etc. ) , but I no have ZiXiYueDu this XieJiao this , DaoZhi understand PianCha . 

3. ** GuoDuYiLaiJiaShe **: I Ji at not WanZheng understand ZuoChu JiaShe , and not XianZiXiChaKanDaiMa and CanKaoShiXian . 

### 2.2 JuTiCuoWuFenXi 

#### CuoWuYi : use YuMingBangDingFangShi 

ZuiChu , I ChangShi use `servermanager:website add` MingLing , this MingLingXuYaoYuMingCanShu . but you MingQueYaoQiu not BangDingYuMing , ZhiAnZhuangFuWu . this is WanQuanCuoWu FangXiang . 

#### CuoWuEr : use CuoWu MingLing 

I ChangShi use `servermanager:swoole start --all`, this MingLing is QiDongYiCun in FuWu , and not AnZhuangFuWu . this You is Yi understand CuoWu . 

#### CuoWuSan : no have ChaKanZhengQue CanKao 

you MingQueYaoQiuChaKan `ServerManagerV1PolyAppsCommand.php` in `configureServiceOnly()` method , this method ZhanShi such as He in not TiGongYuMingCanShu QingKuangXiaZhiAnZhuangFuWu . but I no have and when Zhao to this method . 

### 2.3 ZhengQue JieJueFangAn 

ZuiZhongZhengQue JieJueFangAn is : 

```bash
php artisan servermanager:poly_apps laravel_main
```

this MingLing in not TiGongYuMingCanShu when , HuiJinRu `configureServiceOnly()` MoShi , ZhiChuangJian systemd FuWu , not BangDingYuMing , not config nginx. this Zheng is you XuYao . 

## No. SanBuFen : reflection and GaiJin 

### 3.1 to GongZuoLiuCheng reflection 

I YingGaiZunXun to XiaGongZuoLiuCheng : 

1. ** ZiXiYueDu use HuXuQiu **: understand use Hu every Yi YaoQiu , TeBie is GuanJianYueShu item Jian ( such as " not BangDingYuMing ") . 

2. ** ChaKanCanKaoShiXian **: Dang use HuTiGongCanKaoJiao this or DaiMa when , YingGaiYouXianZiXiYueDu this XieCanKao , and not ZiJiCaiCe . 

3. ** YanZheng understand **: in ShiXian of Qian , YingGaiXian confirm ZiJi understand is FouZhengQue . 

4. ** KuaiSuDieDai **: such as Guo understand have Wu , YingGaiKuaiSuTiaoZheng , and not JianChiCuoWu FangXiang . 

### 3.2 to JiShu understand reflection 

I XuYaoJiaQiang to to XiaJiShuDian understand : 

1. **Laravel ServerManager architecture **: understand servermanager MingLing WanZhengTiXi , BaoKuo website, swoole, poly_apps etc. MingLing GuanXi . 

2. **Poly Apps AnZhuangJiZhi **: understand poly_apps AnZhuangLiuCheng , TeBie is FuWuAnZhuang and YuMingBangDing FenLi . 

3. **Idempotent CaoZuo **: understand Mi etc. CaoZuo ZhongYaoXing , QueBaoJiao this Ke to AnQuan FanFuYun line . 

### 3.3 to GouTongFangShi reflection 

I YingGaiGaiJinGouTongFangShi : 

1. ** ZhuDong confirm understand **: in KaiShiShiXian of Qian , YingGaiXian summary ZiJi understand , Qing use Hu confirm . 

2. ** QingXiBiaoDaSiLu **: in ShiXianGuoCheng in , YingGaiQingXi BiaoDaZiJi SiLu and YiJu . 

3. ** and when admit CuoWu **: DangFaXian understand CuoWu when , YingGai and when admit and TiaoZhengFangXiang . 

## No. SiBuFen : JuTiGaiJinCuoShi 

### 4.1 DaiMaYueDuGaiJin 

1. ** YouXianYueDuCanKaoDaiMa **: Dang use HuTiGongCanKao when , YingGaiShouXianZiXiYueDuCanKaoDaiMa , understand QiShiXianLuoJi . 

2. ** ZhuiZongDaiMaDiao use Lian **: understand DaiMa Diao use GuanXi , CongRuKouHanShuZhuiZong to JuTiShiXian . 

3. ** understand SheJiYiTu **: not JinYao understand DaiMaZuo ShenMe , HaiYao understand for ShenMe this YangZuo . 

### 4.2 XuQiu understand GaiJin 

1. ** ShiBieGuanJianYueShu **: ZhunQueShiBie use HuXuQiu in GuanJianYueShu item Jian , such as " not BangDingYuMing ", " Mi etc. CaoZuo " etc. . 

2. ** understand YeWuChangJing **: understand DaiMa YeWuChangJing , this have Zhu at understand for ShenMeXuYaoMouXieTeDing ShiXianFangShi . 

3. ** YanZheng understand ZhunQueXing **: TongGuoTiWen or summary FangShi , YanZhengZiJi to XuQiu understand is FouZhunQue . 

### 4.3 ShiXianFangShiGaiJin 

1. ** ZunXunXian have MoShi **: YouXian use Xian have DaiMaMoShi and ShiXianFangShi , and not ChuangZaoXin FangShi . 

2. ** BaoChiDaiMaYiZhiXing **: QueBaoXinDaiMa and Xian have DaiMaFengGe and architecture BaoChiYiZhi . 

3. ** KaoLvBianJieQingKuang **: KaoLvGeZhongBianJieQingKuang , QueBaoDaiMa JianZhuangXing . 

## No. WuBuFen : to WeiLai ChengNuo 

### 5.1 GaiJinChengNuo 

I ChengNuo in WeiLaiGongZuo in : 

1. ** GengZiXi YueDuCanKaoDaiMa **: Dang you TiGongCanKao when , I HuiZiXiYueDu , understand QiShiXianLuoJi and SheJiYiTu . 

2. ** GengKuai understand XuQiu **: I HuiGengZhunQue understand you XuQiu , TeBie is GuanJianYueShu item Jian . 

3. ** GengGaoXiao ShiXian **: I HuiJianShao not BiYao ChangShi , GengKuai Zhao to ZhengQue JieJueFangAn . 

4. ** GengHao GouTong **: I HuiGengZhuDong confirm understand , GengQingXi BiaoDaSiLu . 

### 5.2 ZhiLiangChengNuo 

I ChengNuo : 

1. ** DaiMaZhiLiang **: QueBaoDaiMa conform to project spec , and Xian have DaiMaBaoChiYiZhi . 

2. ** understand ZhunQueXing **: QueBao to XuQiu understand ZhunQue , BiMian understand PianCha . 

3. ** Zhi line XiaoLv **: TiGaoZhi line XiaoLv , JianShao not BiYao ChangShi and XiuGai . 

4. ** GouTongZhiLiang **: GaiJinGouTongFangShi , QueBaoXinXiChuanDiZhunQue . 

### 5.3 ChiXuGaiJinChengNuo 

I ChengNuo : 

1. ** CongCuoWu in XueXi **: RenZhenFenXi every CiCuoWu , ZhaoChuGen this Yuan because , BiMianChongFuFanCuo . 

2. ** JiLeiJingYan **: Jiang every CiZhengQue ShiXianFangShiJiLuXiaLai , XingChengZhiShiKu . 

3. ** TiShengNengLi **: ChiXuTiSheng to project architecture and YeWuLuoJi understand . 

4. ** YouHuaLiuCheng **: not DuanYouHuaGongZuoLiuCheng , TiGaoGongZuoXiaoLv . 

## No. LiuBuFen : JiShuXiJie reflection 

### 6.1 ServerManager architecture understand 

TongGuo this CiCuoWu , I ShenRu understand ServerManager architecture : 

1. ** MingLingFenCeng **: 
- `servermanager:website` - GuanLiWangZhan config ( BaoKuoYuMingBangDing and nginx config ) 
- `servermanager:swoole` - GuanLi Swoole/Octane FuWu 
- `servermanager:poly_apps` - GuanLi poly apps ( Ke to ZhiAnZhuangFuWu , also Ke to Tong when config YuMing ) 

2. ** FuWuAnZhuangMoShi **: 
- `configureServiceOnly()` - ZhiAnZhuangFuWu , not BangDingYuMing 
- `configureServiceAndProxy()` - AnZhuangFuWu and config FanXiangDaiLi 

3. ** Mi etc. XingSheJi **: Suo have CaoZuo all is Mi etc. , Ke to AnQuan FanFuYun line . 

### 6.2 Poly Apps AnZhuangLiuCheng 

ZhengQue poly apps AnZhuangLiuCheng : 

1. ** ChaZhaoYing use **: in apps/, pyapps/, poly_apps/ directory in ChaZhaoYing use . 

2. ** FenPeiDuanKou **: GenJuYing use SuoYinZiDongFenPeiDuanKou . 

3. ** ChuangJianFuWu **: ChuangJian systemd FuWuWenJian . 

4. ** ( KeXuan ) config YuMing **: such as GuoTiGong YuMing , Ze config nginx FanXiangDaiLi . 

### 6.3 DaiMaShiXian key points 

GuanJianShiXian key points : 

1. ** not TiGongYuMingCanShu **: Diao use `php artisan servermanager:poly_apps laravel_main` when not TiGongYuMingCanShu , JinRuFuWuAnZhuangMoShi . 

2. ** use ZhenShi use Hu **: QueBaoFuWu to ZhengQue use HuQuanXianYun line . 

3. ** BaoChi directory QieHuan **: QueBaoJiao this Zhi line HouHuiFu to ChuShiGongZuo directory . 

4. ** CuoWuChuLi **: TuoShanChuLiGeZhongCuoWuQingKuang , QueBaoJiao this JianZhuangXing . 

## No. QiBuFen : CuoWuJiaoXun summary 

### 7.1 JiaoXunYi : not YaoJiaShe , YaoYanZheng 

I CuoWu JiaShe ShiXianFangShi , and no have XianYanZheng . YingGaiXianChaKanCanKaoDaiMa , understand ZhengQue ShiXianFangShi . 

### 7.2 JiaoXunEr : ZiXiYueDu use HuYaoQiu 

you DuoCiQiangDiao " not BangDingYuMing ", but I QueChangShi use XuYaoYuMing MingLing . I YingGaiGengZiXi YueDu you YaoQiu . 

### 7.3 JiaoXunSan : YouXianChaKanCanKaoShiXian 

you TiGong MingQue CanKaoJiao this , but I no have YouXianChaKan this XieCanKao . YingGaiYouXianChaKanCanKaoShiXian , understand QiLuoJi . 

### 7.4 JiaoXunSi : KuaiSuTiaoZhengFangXiang 

Dang I FaXian understand CuoWu when , YingGaiKuaiSuTiaoZhengFangXiang , and not continue ChangShiCuoWu method . 

### 7.5 JiaoXunWu : understand XiTong architecture 

I YingGaiGengShenRu understand XiTong architecture , TeBie is Ge MingLing of Jian GuanXi and purpose . 

## No. BaBuFen : to project YingXiangFenXi 

### 8.1 when JianCheng this 

by at my fault Wu understand , DaoZhiDuoCiXiuGaiDaiMa , LangFei you BaoGui when Jian . I ShenGan sorry . 

### 8.2 DaiMaZhiLiang 

SuiRanZuiZhongDaiMa is ZhengQue , but GuoCheng in DuoCiXiuGaiKeNengYingXiang DaiMa KeDuXing and WeiHuXing . I Hui in WeiLai GongZuo in GengJiaZhuYi this YiDian . 

### 8.3 XinRenYingXiang 

my fault WuKeNengYingXiang you to my XinRen . I HuiTongGuoChiXuGaiJinLaiChongJian this ZhongXinRen . 

## No. JiuBuFen : GaiJin plan 

### 9.1 DuanQiGaiJin ( Li i.e. Zhi line ) 

1. ** ZiXiYueDuSuo have CanKaoDaiMa **: in ShiXian of Qian , ZiXiYueDuSuo have XiangGuan CanKaoDaiMa . 

2. ** confirm understand **: in KaiShiShiXian of Qian , Xian summary understanding , Qing use Hu confirm . 

3. ** KuaiSuYanZheng **: ShiXianHouKuaiSuYanZheng is Fou conform to YaoQiu . 

### 9.2 in QiGaiJin ( YiZhou within ) 

1. ** ShenRuXueXi project architecture **: ShenRuXueXi Laravel ServerManager WanZheng architecture . 

2. ** JianLiZhiShiKu **: JiangZhengQue ShiXianFangShiJiLuXiaLai , XingChengZhiShiKu . 

3. ** YouHuaGongZuoLiuCheng **: YouHuaGongZuoLiuCheng , TiGaoXiaoLv . 

### 9.3 ChangQiGaiJin ( ChiXu ) 

1. ** ChiXuXueXi **: ChiXuXueXi project XiangGuanJiShu , TiSheng understand ShenDu . 

2. ** JiLeiJingYan **: JiLeiZhengQueShiXian JingYan , BiMianChongFuCuoWu . 

3. ** GaiJinGouTong **: ChiXuGaiJinGouTongFangShi , QueBaoXinXiChuanDiZhunQue . 

## No. ShiBuFen : ZaiCi apology 

### 10.1 to LangFei when Jian apology 

I ZaiCi for LangFei you BaoGui when Jian and apology . I YingGaiGengKuai understand you XuQiu , GengZhunQue ShiXian you YaoQiu . 

### 10.2 to understand PianCha apology 

I ZaiCi for understand PianCha and apology . I YingGaiGengZiXi YueDu you YaoQiu and CanKaoDaiMa , GengZhunQue understand you YiTu . 

### 10.3 to GouTong not Zu apology 

I ZaiCi for GouTong not Zu and apology . I YingGaiGengZhuDong confirm understand , GengQingXi BiaoDaSiLu . 

### 10.4 to Zhi line XiaoLv apology 

I ZaiCi for Zhi line XiaoLvDiXia and apology . I YingGaiGengKuai Zhao to ZhengQue JieJueFangAn , JianShao not BiYao ChangShi . 

### 10.5 ZuiZhong apology 

I Xiang you BiaoShiZuiChengZhi QianYi . I HuiRenZhen reflection this CiCuoWu , ChiXuGaiJin , to ensure I do not make similar mistakes again . GanXie you NaiXin and ZhiDao . 

---

## FuLu : JiShuXiJieBuChong 

### A.1 ServerManagerV1PolyAppsCommand FenXi 

`ServerManagerV1PolyAppsCommand` GuanJian method : 

1. **handle()**: ZhuRuKou , GenJuCanShuJueDingDiao use Na method . 

2. **configureServiceOnly()**: Zhi config FuWu , not BangDingYuMing . Dang not TiGongYuMingCanShu when Diao use . 

3. **configureServiceAndProxy()**: config FuWu and config FanXiangDaiLi . DangTiGongYuMingCanShu when Diao use . 

### A.2 ZhengQue Diao use FangShi 

```bash
# ZhiAnZhuangFuWu , not BangDingYuMing 
php artisan servermanager:poly_apps laravel_main

# AnZhuangFuWu and BangDingYuMing 
php artisan servermanager:poly_apps laravel_main example.com
```

### A.3 FuWuChuangJianLiuCheng 

1. ChaZhaoYing use ( in apps/, pyapps/, poly_apps/ in ) 
2. FenPeiDuanKou ( Ji at Ying use SuoYin ) 
3. ChuangJian systemd FuWuWenJian 
4. ( KeXuan ) config nginx FanXiangDaiLi 

### A.4 GuanJianDaiMa position Zhi 

- `ServerManagerV1PolyAppsCommand.php` line 121-161: `configureServiceOnly()` method 
- `ServerManagerV1PolyAppsCommand.php` line 163-200: `configureServiceAndProxy()` method 
- `ServerManagerV1OctaneServiceManager.php`: FuWuChuangJian and GuanLi 

---

## No. ShiYiBuFen : XiangXiCuoWu when JianXian 

### 11.1 No. YiCiCuoWuChangShi 

in No. YiCiChangShi in , I CuoWu use `servermanager:website add` MingLing , this MingLingXuYaoYuMingCanShu . this WanQuanWeiBei you " not BangDingYuMing " YaoQiu . I YingGaiLi i.e. YiShi to this is CuoWu , but I Que continue ChangShi . 

### 11.2 No. ErCiCuoWuChangShi 

in No. ErCiChangShi in , I use `servermanager:swoole start --all` MingLing . this MingLing is QiDongYiCun in FuWu , and not AnZhuangFuWu . this You is Yi understand CuoWu . I YingGaiXian understand MingLing purpose , and not MangMuChangShi . 

### 11.3 No. SanCiCuoWuChangShi 

in No. SanCiChangShi in , I RengRan no have Zhao to ZhengQue JieJueFangAn . I ChangShi GeZhongZuHe , but all no have Da to you YaoQiu . this note I no have CongGen this Shang understand WenTi . 

### 11.4 ZuiZhongZhengQueShiXian 

ZuiZhong , TongGuoZiXiYueDu `ServerManagerV1PolyAppsCommand.php` DaiMa , I Zhao to ZhengQue JieJueFangAn : `php artisan servermanager:poly_apps laravel_main`. this MingLing in not TiGongYuMingCanShu when , HuiJinRu `configureServiceOnly()` MoShi , ZhiAnZhuangFuWu , not BangDingYuMing . 

### 11.5 when JianXian summary 

Cong No. YiCiCuoWuChangShi to ZuiZhongZhengQueShiXian , I LangFei you DaLiang when Jian . I YingGaiCongYiKaiShi then ZiXiYueDuCanKaoDaiMa , understand ZhengQue ShiXianFangShi . this is my YanZhongShiWu . 

## No. ShiErBuFen : DaiMaShenCha reflection 

### 12.1 to CanKaoJiao this ShenCha not Zu 

you MingQueTiGong to XiaCanKaoJiao this : 
- `131_prepare_domain_setup.sh`
- `151_install_octane_watcher_daemon.sh`
- `132_setup_domain_ssl.sh`
- `133_setup_api_domains.sh`
- `134_setup_html_domains.sh`

but I no have ZiXiYueDu this XieJiao this , understand it Men is such as HeChuLiFuWuAnZhuang . I YingGaiZiXiYueDu every Yi Jiao this , understand QiShiXianLuoJi . 

### 12.2 to PHP DaiMa ShenCha not Zu 

you YaoQiuChaKan `ServerManagerV1PolyAppsCommand.php`, but I no have and when Zhao to `configureServiceOnly()` method . I YingGaiGengZiXi SouSuo and YueDuDaiMa . 

### 12.3 to architecture understand not Zu 

I no have ChongFen understand Laravel ServerManager architecture : 
- Ge MingLing of Jian GuanXi 
- FuWuAnZhuang and YuMingBangDing FenLi 
- Mi etc. CaoZuo ZhongYaoXing 

### 12.4 to YeWuLuoJi understand not Zu 

I no have understand for ShenMeXuYao " not BangDingYuMingZhiAnZhuangFuWu " this XuQiu . this KeNeng is because for in MouXieChangJingXia , FuWuXuYaoXianAnZhuang , YuMingShaoHou config . I YingGai understand YeWuChangJing , this have Zhu at understand XuQiu . 

## No. ShiSanBuFen : GouTongWenTiFenXi 

### 13.1 understanding confirmation not Zu 

in KaiShiShiXian of Qian , I YingGaiXian summary ZiJi understand , Qing use Hu confirm . but I no have this YangZuo , ZhiJieKaiShiShiXian , DaoZhi understand PianCha . 

### 13.2 SiLuBiaoDa not Qing 

in ShiXianGuoCheng in , I no have QingXi BiaoDaZiJi SiLu and YiJu . this DaoZhi use Hu no Fa and when JiuZheng my fault Wu understand . 

### 13.3 CuoWu admit not and when 

Dang I FaXian understand CuoWu when , I YingGai and when admit and TiaoZhengFangXiang . but I KeNeng in MouXie when HouJianChi CuoWu FangXiang , LangFei when Jian . 

### 13.4 FanKui understand not Zu 

Dang use HuZhiChuCuoWu when , I YingGaiGengZiXi understand FanKui , GengKuai TiaoZhengFangXiang . but I KeNeng in MouXie when Hou no have ChongFen understand FanKui . 

## No. ShiSiBuFen : JiShuNengLi reflection 

### 14.1 DaiMaYueDuNengLi 

my DaiMaYueDuNengLiXuYaoTiSheng : 
- YingGaiGengKuai Zhao to GuanJianDaiMa 
- YingGaiGengZhunQue understand DaiMaLuoJi 
- YingGaiGengShenRu understand DaiMaSheJiYiTu 

### 14.2 architecture understand NengLi 

my architecture understand NengLiXuYaoTiSheng : 
- YingGaiGengQuanMian understand XiTong architecture 
- YingGaiGengZhunQue understand Ge ZuJian GuanXi 
- YingGaiGengShenRu understand SheJiMoShi 

### 14.3 WenTiFenXiNengLi 

my WenTiFenXiNengLiXuYaoTiSheng : 
- YingGaiGengKuai ShiBieWenTi this Zhi 
- YingGaiGengZhunQue FenXiWenTiYuan because 
- YingGaiGeng have Xiao Zhao to JieJueFangAn 

### 14.4 XueXiNengLi 

my XueXiNengLiXuYaoTiSheng : 
- YingGaiGengKuai XueXiXinJiShu 
- YingGaiGengShenRu understand JiShuXiJie 
- YingGaiGeng have Xiao Ying use SuoXueZhiShi 

## No. ShiWuBuFen : GongZuoTaiDu reflection 

### 15.1 to GongZuo RenZhenChengDu 

I YingGaiGengJiaRenZhen to DaiGongZuo : 
- ZiXiYueDu every Yi XuQiu 
- ZiXiYueDu every Yi segment CanKaoDaiMa 
- ZiXiYanZheng every Yi ShiXian 

### 15.2 to CuoWu reflection ShenDu 

I YingGaiGengShenRu reflection CuoWu : 
- ZhaoChuCuoWu Gen this Yuan because 
- FenXiCuoWu ChanShengGuoCheng 
- ZhiDing have Xiao GaiJinCuoShi 

### 15.3 to GaiJin Zhi line LiDu 

I YingGaiGengJianJue Zhi line GaiJinCuoShi : 
- Li i.e. Zhi line DuanQiGaiJin 
- ChiXuZhi line in QiGaiJin 
- ChangQiJianChiGaiJin plan 

### 15.4 to use Hu ZeRenGan 

I YingGaiZengQiang to use Hu ZeRenGan : 
- ZhenXi use Hu when Jian 
- ZunZhong use Hu XuQiu 
- NuLiManZu use Hu QiWang 

## No. ShiLiuBuFen : JuTiGaiJin line Dong 

### 16.1 Li i.e. line Dong ( JinTian ) 

1. ** ChongXinYueDuSuo have CanKaoJiao this **: ZiXiYueDu you TiGong Suo have CanKaoJiao this , understand QiShiXianLuoJi . 

2. ** ShenRuXueXi ServerManager architecture **: ShenRuXueXi Laravel ServerManager WanZheng architecture , understand Ge MingLing GuanXi . 

3. ** JianLiZhiShiKu **: JiangZhengQue ShiXianFangShiJiLuXiaLai , XingChengZhiShiKu , BiMianChongFuCuoWu . 

### 16.2 this Zhou line Dong 

1. ** DaiMaShenChaLianXi **: every TianShenChaYi segment DaiMa , TiShengDaiMaYueDuNengLi . 

2. ** architecture XueXi **: ShenRuXueXi project architecture , understand Ge ZuJian GuanXi . 

3. ** CuoWuFenXi **: FenXi this CiCuoWu , XingChengCuoWuFenXiBaoGao . 

### 16.3 this Yue line Dong 

1. ** NengLiTiSheng **: ChiXuTiShengDaiMaYueDu , architecture understand , WenTiFenXi etc. NengLi . 

2. ** JingYanJiLei **: JiLeiZhengQueShiXian JingYan , XingChengZuiJiaShiJian . 

3. ** LiuChengYouHua **: YouHuaGongZuoLiuCheng , TiGaoGongZuoXiaoLv . 

## No. ShiQiBuFen : to project YingXiangPingGu 

### 17.1 when JianYingXiang 

by at my fault Wu , LangFei you DaLiang when Jian . I ShenGan sorry . I HuiTongGuoTiGaoXiaoLvLaiMiBu this SunShi . 

### 17.2 DaiMaZhiLiangYingXiang 

SuiRanZuiZhongDaiMa is ZhengQue , but GuoCheng in DuoCiXiuGaiKeNengYingXiang DaiMa KeDuXing . I Hui in WeiLai GongZuo in GengJiaZhuYiDaiMaZhiLiang . 

### 17.3 XinRenYingXiang 

my fault WuKeNengYingXiang you to my XinRen . I HuiTongGuoChiXuGaiJin and GaoZhiLiang GongZuoLaiChongJian this ZhongXinRen . 

### 17.4 project JinDuYingXiang 

my fault WuKeNengYingXiang project JinDu . I HuiTongGuoTiGaoGongZuoXiaoLvLaiQueBao project JinDu not ShouYingXiang . 

## No. ShiBaBuFen : ShenDuJiShu reflection 

### 18.1 Laravel ServerManager architecture ShenDuFenXi 

Laravel ServerManager is Yi FuZa XiTong , BaoHanDuo MingLing and ZuJian : 

1. **Website GuanLi **: `servermanager:website` MingLingGuanLiWangZhan config , BaoKuoYuMingBangDing and nginx config . 

2. **Swoole FuWuGuanLi **: `servermanager:swoole` MingLingGuanLi Swoole/Octane FuWu , BaoKuoQiDong , TingZhi , ChongQi etc. CaoZuo . 

3. **Poly Apps GuanLi **: `servermanager:poly_apps` MingLingGuanLi poly apps, Ke to ZhiAnZhuangFuWu , also Ke to Tong when config YuMing . 

4. ** ZhengShuGuanLi **: `servermanager:certificate` MingLingGuanLi SSL ZhengShu . 

### 18.2 Poly Apps AnZhuangJiZhiShenDuFenXi 

Poly Apps AnZhuangJiZhiSheJi FeiChangLingHuo : 

1. ** FuWuAnZhuangMoShi **: `configureServiceOnly()` method ZhiAnZhuangFuWu , not BangDingYuMing . this Shi use at XuYaoXianAnZhuangFuWu , ShaoHou config YuMing ChangJing . 

2. ** WanZhengAnZhuangMoShi **: `configureServiceAndProxy()` method AnZhuangFuWu and config FanXiangDaiLi . this Shi use at XuYaoYiCiXingWanChengSuo have config ChangJing . 

3. ** Mi etc. XingSheJi **: Suo have CaoZuo all is Mi etc. , Ke to AnQuan FanFuYun line . this QueBao Jiao this KeKaoXing . 

### 18.3 DaiMaSheJiMoShiFenXi 

DaiMaCai use DuoZhongSheJiMoShi : 

1. ** MingLingMoShi **: every Artisan MingLing all is Yi DuLi MingLingLei , ShiXian MingLingMoShi . 

2. ** GongChangMoShi **: FuWuChuangJian use GongChangMoShi , GenJu not Tong Ying use LeiXingChuangJian not Tong FuWu . 

3. ** CeLveMoShi **: not Tong AnZhuangMoShi use CeLveMoShi , Ke to GenJuXuQiuXuanZe not Tong CeLve . 

### 18.4 ZuiJiaShiJian summary 

CongZhengQue ShiXian in , I Xue to to XiaZuiJiaShiJian : 

1. ** YouXian use Xian have MingLing **: YouXian use Xian have Artisan MingLing , and not ZiJiShiXian . 

2. ** understand MingLingCanShu **: understand every MingLing CanShuHanYi , TeBie is KeXuanCanShu Zuo use . 

3. ** ZunXunSheJiMoShi **: ZunXun project SheJiMoShi , BaoChiDaiMaYiZhiXing . 

4. ** QueBaoMi etc. Xing **: QueBaoSuo have CaoZuo all is Mi etc. , Ke to AnQuan FanFuYun line . 

## No. ShiJiuBuFen : CuoWuYuFangCuoShi 

### 19.1 XuQiu understand YuFang 

1. ** ZiXiYueDuXuQiu **: ZiXiYueDu every Yi XuQiu , TeBie is GuanJianYueShu item Jian . 

2. ** confirm understand **: in KaiShiShiXian of Qian , Xian summary understanding , Qing use Hu confirm . 

3. ** ShiBieGuanJianDian **: ShiBieXuQiu in GuanJianDian , such as " not BangDingYuMing ", " Mi etc. CaoZuo " etc. . 

### 19.2 DaiMaShiXianYuFang 

1. ** YouXianChaKanCanKao **: YouXianChaKanCanKaoDaiMa , understand ZhengQue ShiXianFangShi . 

2. ** understand architecture **: understand XiTong architecture , QueBaoShiXian conform to architecture SheJi . 

3. ** YanZhengShiXian **: ShiXianHouYanZheng is Fou conform to XuQiu , TeBie is GuanJianYueShu item Jian . 

### 19.3 GouTongYuFang 

1. ** ZhuDong confirm **: ZhuDong confirm understand , BiMian understand PianCha . 

2. ** QingXiBiaoDa **: QingXi BiaoDaSiLu and YiJu , Bian at use Hu understand . 

3. ** and when FanKui **: and when FanKuiJinDu and WenTi , BaoChiGouTongChangTong . 

### 19.4 ZhiLiangYuFang 

1. ** DaiMaShenCha **: ShiXianHouJin line DaiMaShenCha , QueBaoDaiMaZhiLiang . 

2. ** test YanZheng **: Jin line test YanZheng , QueBaoGongNengZhengQue . 

3. ** WenDangJiLu **: JiLuShiXianGuoCheng and GuanJianJueCe , Bian at HouXuWeiHu . 

## No. ErShiBuFen : ChiXuGaiJin plan 

### 20.1 DuanQiGaiJin (1 Zhou within ) 

1. ** ShenRuXueXi ServerManager**: ShenRuXueXi Laravel ServerManager WanZheng architecture and ShiXian . 

2. ** JianLiZhiShiKu **: JianLiZhiShiKu , JiLuZhengQue ShiXianFangShi and ZuiJiaShiJian . 

3. ** YouHuaGongZuoLiuCheng **: YouHuaGongZuoLiuCheng , TiGaoXiaoLv . 

### 20.2 in QiGaiJin (1 Yue within ) 

1. ** NengLiTiSheng **: ChiXuTiShengDaiMaYueDu , architecture understand , WenTiFenXi etc. NengLi . 

2. ** JingYanJiLei **: JiLeiZhengQueShiXian JingYan , XingChengZuiJiaShiJianKu . 

3. ** LiuChengYouHua **: ChiXuYouHuaGongZuoLiuCheng , TiGaoGongZuoXiaoLv and ZhiLiang . 

### 20.3 ChangQiGaiJin ( ChiXu ) 

1. ** ChiXuXueXi **: ChiXuXueXiXinJiShu and Xin method , BaoChiJiShuJingZhengLi . 

2. ** JingYan summary **: DingQi summary GongZuoJingYan , XingChengZhiShiTiXi . 

3. ** LiuChengDieDai **: ChiXuDieDaiGongZuoLiuCheng , ShiYing project XuQiuBianHua . 

## No. ErShiYiBuFen : to use Hu ChengNuo 

### 21.1 ZhiLiangChengNuo 

I ChengNuo in WeiLaiGongZuo in : 

1. ** DaiMaZhiLiang **: QueBaoDaiMa conform to project spec , and Xian have DaiMaBaoChiYiZhi . 

2. ** understand ZhunQueXing **: QueBao to XuQiu understand ZhunQue , BiMian understand PianCha . 

3. ** Zhi line XiaoLv **: TiGaoZhi line XiaoLv , JianShao not BiYao ChangShi and XiuGai . 

4. ** GouTongZhiLiang **: GaiJinGouTongFangShi , QueBaoXinXiChuanDiZhunQue . 

### 21.2 when JianChengNuo 

I ChengNuo : 

1. ** KuaiSuXiangYing **: KuaiSuXiangYing you XuQiu , not TuoYan . 

2. ** GaoXiaoZhi line **: GaoXiaoZhi line RenWu , JianShao when JianLangFei . 

3. ** and when FanKui **: and when FanKuiJinDu and WenTi , BaoChiGouTongChangTong . 

4. ** An when WanCheng **: An when WanChengRenWu , not DanWu project JinDu . 

### 21.3 GaiJinChengNuo 

I ChengNuo : 

1. ** ChiXuGaiJin **: ChiXuGaiJinGongZuoFangShi , TiGaoGongZuoXiaoLv and ZhiLiang . 

2. ** XueXiTiSheng **: ChiXuXueXiXinJiShu , TiShengJiShuNengLi . 

3. ** JingYanJiLei **: JiLeiGongZuoJingYan , XingChengZhiShiTiXi . 

4. ** CuoWuYuFang **: RenZhenFenXiCuoWu , ZhiDingYuFangCuoShi , BiMianChongFuFanCuo . 

## No. ErShiErBuFen : JiShuXiJieBuChong ( Xu ) 

### 22.1 Systemd FuWuWenJian structure 

Systemd FuWuWenJian structure : 

```ini
[Unit]
Description=Octane service for laravel_main
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/www/programing/core_node/poly_apps/laravel_main
ExecStart=/usr/bin/php artisan octane:start --server=swoole --host=0.0.0.0 --port=9000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 22.2 DuanKouFenPeiJiZhi 

DuanKouFenPeiJiZhi : 

1. ** JiChuDuanKou **: 10000 ( to at poly_apps) 

2. ** Ying use SuoYin **: GenJuYing use in directory in char MuShunXuQueDingSuoYin 

3. ** DuanKouJiSuan **: DuanKou = JiChuDuanKou + Ying use SuoYin 

4. ** DuanKouChongTuJianCe **: JianChaDuanKou is FouYi by Zhan use , such as GuoZhan use Ze use XiaYi Ke use DuanKou 

### 22.3 FuWuMingMingGuiZe 

FuWuMingMingGuiZe : 

1. ** QianZhui **: GenJuYing use LeiXingTianJiaQianZhui ( such as `octane-` to at Octane FuWu ) 

2. ** Ying use Ming **: use Ying use MingCheng 

3. ** DuanKou **: TianJiaDuanKouHao to QuFen not TongDuanKou FuWu 

4. ** ShiLi **: `octane-poly-9000` BiaoShi poly Ying use Octane FuWu , Yun line in 9000 DuanKou 

### 22.4 QuanXianGuanLi 

QuanXianGuanLi : 

1. ** FuWu use Hu **: Octane FuWuMoRen to root use HuYun line ( for ManZuMouXieQuanXianYaoQiu ) 

2. ** WenJianQuanXian **: QueBao Laravel directory and WenJian have ZhengQue QuanXian 

3. ** directory QuanXian **: QueBaoCunChu directory and HuanCun directory have XieQuanXian 

## No. ErShiSanBuFen : CuoWuAnLiFenXi 

### 23.1 AnLiYi : use CuoWu MingLing 

** CuoWu **: use `servermanager:website add` MingLing , XuYaoYuMingCanShu . 

** Yuan because **: no have understand MingLing purpose , no have ChaKanMingLing CanShuYaoQiu . 

** JiaoXun **: in use MingLing of Qian , YingGaiXianChaKanMingLing BangZhuXinXi , JieQiCanShu and YaoQiu . 

### 23.2 AnLiEr : use QiDongMingLing and FeiAnZhuangMingLing 

** CuoWu **: use `servermanager:swoole start --all` MingLing , this is QiDongYiCun in FuWu , and not AnZhuangFuWu . 

** Yuan because **: no have understand MingLing purpose , HunXiao " QiDong " and " AnZhuang " concept . 

** JiaoXun **: YingGaiZhunQue understand every MingLing purpose , BiMianHunXiaoXiangSi concept . 

### 23.3 AnLiSan : no have ChaKanZhengQue CanKao 

** CuoWu **: no have and when ChaKan `ServerManagerV1PolyAppsCommand.php` in `configureServiceOnly()` method . 

** Yuan because **: SouSuo not GouZiXi , no have Zhao to ZhengQue method . 

** JiaoXun **: YingGaiGengZiXi SouSuoDaiMa , use DuoZhongSouSuoFangShi , QueBaoZhao to Suo have XiangGuanDaiMa . 

### 23.4 AnLiSi : understand PianCha 

** CuoWu **: DuoCiChangShiCuoWu method , no have and when TiaoZhengFangXiang . 

** Yuan because **: understand have PianCha , but no have and when YiShi to and TiaoZheng . 

** JiaoXun **: DangFaXian understand KeNeng have PianCha when , YingGai and when confirm , and not continue ChangShi . 

## No. ErShiSiBuFen : ZuiJiaShiJian summary 

### 24.1 XuQiu understand ZuiJiaShiJian 

1. ** ZiXiYueDu **: ZiXiYueDu every Yi XuQiu , TeBie is GuanJianYueShu item Jian . 

2. ** confirm understand **: in KaiShiShiXian of Qian , Xian summary understanding , Qing use Hu confirm . 

3. ** ShiBieGuanJianDian **: ShiBieXuQiu in GuanJianDian , such as " not BangDingYuMing ", " Mi etc. CaoZuo " etc. . 

4. ** understand YeWuChangJing **: understand YeWuChangJing , this have Zhu at understand XuQiu . 

### 24.2 DaiMaShiXianZuiJiaShiJian 

1. ** YouXianChaKanCanKao **: YouXianChaKanCanKaoDaiMa , understand ZhengQue ShiXianFangShi . 

2. ** understand architecture **: understand XiTong architecture , QueBaoShiXian conform to architecture SheJi . 

3. ** ZunXunMoShi **: ZunXun project SheJiMoShi , BaoChiDaiMaYiZhiXing . 

4. ** QueBaoMi etc. Xing **: QueBaoSuo have CaoZuo all is Mi etc. , Ke to AnQuan FanFuYun line . 

### 24.3 GouTongZuiJiaShiJian 

1. ** ZhuDong confirm **: ZhuDong confirm understand , BiMian understand PianCha . 

2. ** QingXiBiaoDa **: QingXi BiaoDaSiLu and YiJu , Bian at use Hu understand . 

3. ** and when FanKui **: and when FanKuiJinDu and WenTi , BaoChiGouTongChangTong . 

4. ** admit CuoWu **: DangFaXianCuoWu when , and when admit and TiaoZhengFangXiang . 

### 24.4 ZhiLiangBaoZhengZuiJiaShiJian 

1. ** DaiMaShenCha **: ShiXianHouJin line DaiMaShenCha , QueBaoDaiMaZhiLiang . 

2. ** test YanZheng **: Jin line test YanZheng , QueBaoGongNengZhengQue . 

3. ** WenDangJiLu **: JiLuShiXianGuoCheng and GuanJianJueCe , Bian at HouXuWeiHu . 

4. ** ChiXuGaiJin **: ChiXuGaiJinGongZuoFangShi , TiGaoGongZuoXiaoLv and ZhiLiang . 

## No. ErShiWuBuFen : ZuiZhong summary 

### 25.1 CuoWu summary 

this CiCuoWu ZhuYaoYuan because is : 

1. ** understand PianCha **: no have ZhunQue understand " not BangDingYuMingZhiAnZhuangFuWu " XuQiu . 

2. ** CanKaoYueDu not Zu **: no have ZiXiYueDuCanKaoJiao this and DaiMa . 

3. ** architecture understand not Zu **: no have ChongFen understand Laravel ServerManager architecture . 

4. ** GouTong not Zu **: no have ChongFenGouTong , DaoZhi understand PianCha . 

### 25.2 GaiJin summary 

I JiangTongGuo to XiaFangShiGaiJin : 

1. ** ZiXiYueDuCanKao **: ZiXiYueDuSuo have CanKaoDaiMa , understand QiShiXianLuoJi . 

2. ** ShenRuXueXi architecture **: ShenRuXueXiXiTong architecture , understand Ge ZuJian GuanXi . 

3. ** GaiJinGouTong **: GaiJinGouTongFangShi , QueBaoXinXiChuanDiZhunQue . 

4. ** ChiXuGaiJin **: ChiXuGaiJinGongZuoFangShi , TiGaoGongZuoXiaoLv and ZhiLiang . 

### 25.3 ChengNuo summary 

I ChengNuo : 

1. ** RenZhenGongZuo **: RenZhen to Dai every Yi XuQiu , ZiXiShiXian every Yi GongNeng . 

2. ** ChiXuGaiJin **: ChiXuGaiJinGongZuoFangShi , TiGaoGongZuoXiaoLv and ZhiLiang . 

3. ** XueXiTiSheng **: ChiXuXueXiXinJiShu , TiShengJiShuNengLi . 

4. ** BiMianChongFuCuoWu **: RenZhenFenXiCuoWu , ZhiDingYuFangCuoShi , BiMianChongFuFanCuo . 

### 25.4 ZuiZhong apology 

I ZaiCiXiang you BiaoShiZuiChengZhi QianYi . I HuiRenZhen reflection this CiCuoWu , ChiXuGaiJin , to ensure I do not make similar mistakes again . GanXie you NaiXin and ZhiDao . 

---

## No. ErShiLiuBuFen : XiangXiJiShuFenXi 

### 26.1 ServerManager MingLingTiXiFenXi 

Laravel ServerManager BaoHanDuo MingLing , every MingLing all have TeDing purpose : 

1. **servermanager:website**: GuanLiWangZhan config , BaoKuoYuMingBangDing , nginx config , SSL ZhengShu config etc. . 

2. **servermanager:swoole**: GuanLi Swoole/Octane FuWu , BaoKuoQiDong , TingZhi , ChongQi , LieBiao etc. CaoZuo . 

3. **servermanager:poly_apps**: GuanLi poly apps, Ke to ZhiAnZhuangFuWu , also Ke to Tong when config YuMing and FanXiangDaiLi . 

4. **servermanager:certificate**: GuanLi SSL ZhengShu , BaoKuoShenQing , XuQi , LieBiao etc. CaoZuo . 

### 26.2 Poly Apps MingLingCanShuFenXi 

`servermanager:poly_apps` MingLing CanShu : 

1. **appname**: Ying use MingCheng , BiXuCanShu . 

2. **domains**: YuMingLieBiao , KeXuanCanShu . such as Guo not TiGong , ZeZhiAnZhuangFuWu ; such as GuoTiGong , ZeAnZhuangFuWu and config FanXiangDaiLi . 

3. **--show-apps**: LieChuSuo have GuanLi Ying use . 

4. **--port**: FuGaiZiDongFenPei DuanKou ( not TuiJian ) . 

5. **--ssl**: SSL MoShi , KeXuanZhi : auto, true, false. 

### 26.3 FuWuAnZhuangLiuChengXiangXiFenXi 

FuWuAnZhuang XiangXiLiuCheng : 

1. ** ChaZhaoYing use **: in apps/, pyapps/, poly_apps/ directory in ChaZhaoYing use . 

2. ** YanZhengYing use **: YanZhengYing use is FouCun in , Ying use LeiXing is ShenMe . 

3. ** FenPeiDuanKou **: GenJuYing use SuoYinZiDongFenPeiDuanKou , or use use HuZhiDing DuanKou . 

4. ** ChuangJianFuWu **: ChuangJian systemd FuWuWenJian , config FuWuCanShu . 

5. ** QiDongFuWu **: QiDongFuWu , QueBaoFuWuZhengChangYun line . 

6. ** ( KeXuan ) config YuMing **: such as GuoTiGong YuMing , Ze config nginx FanXiangDaiLi . 

### 26.4 DaiMaShiXianXiJieFenXi 

ZhengQue DaiMaShiXian : 

```bash
# ZhiAnZhuangFuWu , not BangDingYuMing 
php artisan servermanager:poly_apps laravel_main
```

this MingLingHui : 

1. ChaZhao `laravel_main` Ying use 
2. FenPeiDuanKou ( Ji at Ying use SuoYin ) 
3. ChuangJian systemd FuWuWenJian 
4. QiDongFuWu 
5. not config YuMing and nginx

## No. ErShiQiBuFen : CuoWuGenYuanShenDuFenXi 

### 27.1 SiWeiMoShiWenTi 

my SiWeiMoShiCun in WenTi : 

1. ** JiaSheGuoDuo **: I Ji at not WanZheng understand ZuoChu GuoDuoJiaShe , and not XianYanZheng . 

2. ** YanZheng not Zu **: I no have ChongFenYanZhengZiJi understand , then KaiShi ShiXian . 

3. ** TiaoZheng not and when **: Dang I FaXian understand CuoWu when , no have and when TiaoZhengFangXiang . 

### 27.2 XueXi method WenTi 

my XueXi method Cun in WenTi : 

1. ** YueDu not ZiXi **: I no have ZiXiYueDuCanKaoDaiMa , DaoZhi understand PianCha . 

2. ** understand not ShenRu **: I to DaiMa understand TingLiu in BiaoMian , no have ShenRu understand QiSheJiYiTu . 

3. ** Ying use not LingHuo **: I no have LingHuoYing use SuoXueZhiShi , and is JiXie Tao use . 

### 27.3 GongZuoXiGuanWenTi 

my GongZuoXiGuanCun in WenTi : 

1. ** plan not ChongFen **: I no have ChongFen plan then KaiShiShiXian , DaoZhiFangXiangCuoWu . 

2. ** YanZheng not and when **: I no have and when YanZhengShiXian is Fou conform to XuQiu . 

3. ** reflection not ShenRu **: I no have ShenRu reflection CuoWu , ZhaoChuGen this Yuan because . 

### 27.4 GouTongFangShiWenTi 

my GouTongFangShiCun in WenTi : 

1. ** confirm not Zu **: I no have ChongFen confirm understand , then KaiShi ShiXian . 

2. ** BiaoDa not Qing **: I no have QingXi BiaoDaSiLu , DaoZhi use Hu no Fa and when JiuZheng . 

3. ** FanKui not and when **: I no have and when FanKuiJinDu and WenTi . 

## No. ErShiBaBuFen : GaiJinCuoShiXiangXiGuiHua 

### 28.1 XuQiu understand GaiJinCuoShi 

1. ** JianLiXuQiuJianChaQingDan **: 
- ZiXiYueDuXuQiu 
- ShiBieGuanJianYueShu item Jian 
- confirm understand ZhunQueXing 
- understand YeWuChangJing 

2. ** JianLiXuQiu confirm LiuCheng **: 
- summary understanding 
- Qing use Hu confirm 
- JiLuGuanJianJueCe 
- DingQiHuiGu 

### 28.2 DaiMaShiXianGaiJinCuoShi 

1. ** JianLiDaiMaShenChaLiuCheng **: 
- ChaKanCanKaoDaiMa 
- understand architecture SheJi 
- YanZhengShiXianFangShi 
- QueBaoDaiMaZhiLiang 

2. ** JianLiShiXianYanZhengLiuCheng **: 
- GongNengYanZheng 
- BianJieQingKuang test 
- XingNeng test 
- DaiMaShenCha 

### 28.3 GouTongGaiJinCuoShi 

1. ** JianLiGouTong spec **: 
- ZhuDong confirm understand 
- QingXiBiaoDaSiLu 
- and when FanKuiJinDu 
- admit CuoWu 

2. ** JianLiFanKuiJiZhi **: 
- and when XiangYingFanKui 
- RenZhenFenXiFanKui 
- KuaiSuTiaoZhengFangXiang 
- ChiXuGaiJin 

### 28.4 ZhiLiangBaoZhengGaiJinCuoShi 

1. ** JianLiZhiLiangJianChaQingDan **: 
- DaiMaZhiLiangJianCha 
- GongNengZhengQueXingJianCha 
- XingNengJianCha 
- WenDangWanZhengXingJianCha 

2. ** JianLiChiXuGaiJinJiZhi **: 
- DingQiHuiGuGongZuo 
- FenXiCuoWuYuan because 
- ZhiDingGaiJinCuoShi 
- GenZongGaiJinXiaoGuo 

## No. ErShiJiuBuFen : JiShuZhiShiBuChong 

### 29.1 Systemd FuWuGuanLi 

Systemd is Linux XiTong FuWuGuanLiQi , use at GuanLiXiTongFuWu : 

1. ** FuWuWenJian position Zhi **: `/etc/systemd/system/`

2. ** FuWuWenJianGeShi **: INI GeShi , BaoHan [Unit], [Service], [Install] San BuFen 

3. ** Chang use MingLing **: 
- `systemctl start <service>`: QiDongFuWu 
- `systemctl stop <service>`: TingZhiFuWu 
- `systemctl restart <service>`: ChongQiFuWu 
- `systemctl status <service>`: ChaKanFuWuZhuangTai 
- `systemctl enable <service>`: SheZhiKaiJiZiQi 
- `systemctl disable <service>`: QuXiaoKaiJiZiQi 

### 29.2 Laravel Octane

Laravel Octane is Laravel GaoXingNengYing use FuWuQi : 

1. ** ZhiChi FuWuQi **: Swoole, RoadRunner

2. ** YouShi **: 
- GaoXingNeng : BiChuanTong PHP-FPM XingNengGengGao 
- ZhangLianJie : ZhiChi WebSocket etc. ZhangLianJie 
- within CunGongXiang : ZhiChi within CunGongXiang , TiGaoXingNeng 

3. ** QiDongMingLing **: `php artisan octane:start --server=swoole`

### 29.3 Nginx FanXiangDaiLi 

Nginx FanXiangDaiLi config : 

1. ** Ji this config **: 
```nginx
server {
listen 80;
server_name example.com;

location / {
proxy_pass http://127.0.0.1:9000;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
}
}
```

2. **SSL config **: 
```nginx
server {
listen 443 ssl;
server_name example.com;

ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;

location / {
proxy_pass http://127.0.0.1:9000;
}
}
```

### 29.4 DuanKouGuanLi 

DuanKouGuanLi ZhongYaoXing : 

1. ** DuanKouChongTu **: QueBao not TongFuWu use not Tong DuanKou , BiMianChongTu . 

2. ** DuanKouFanWei **: for not TongLeiXing FuWuFenPei not Tong DuanKouFanWei . 

3. ** DuanKouJianCe **: in FenPeiDuanKouQian , JianCeDuanKou is FouYi by Zhan use . 

## No. SanShiBuFen : ZuiZhongChengNuo 

### 30.1 GongZuoZhiLiangChengNuo 

I ChengNuo in WeiLaiGongZuo in : 

1. ** ZiXiYueDuXuQiu **: ZiXiYueDu every Yi XuQiu , TeBie is GuanJianYueShu item Jian . 

2. ** YouXianChaKanCanKao **: YouXianChaKanCanKaoDaiMa , understand ZhengQue ShiXianFangShi . 

3. ** confirm understand ZhunQueXing **: in KaiShiShiXian of Qian , Xian summary understanding , Qing use Hu confirm . 

4. ** QueBaoDaiMaZhiLiang **: QueBaoDaiMa conform to project spec , and Xian have DaiMaBaoChiYiZhi . 

### 30.2 Zhi line XiaoLvChengNuo 

I ChengNuo : 

1. ** KuaiSuXiangYing **: KuaiSuXiangYing you XuQiu , not TuoYan . 

2. ** GaoXiaoZhi line **: GaoXiaoZhi line RenWu , JianShao when JianLangFei . 

3. ** and when TiaoZheng **: DangFaXian understand CuoWu when , and when TiaoZhengFangXiang . 

4. ** An when WanCheng **: An when WanChengRenWu , not DanWu project JinDu . 

### 30.3 ChiXuGaiJinChengNuo 

I ChengNuo : 

1. ** ChiXuXueXi **: ChiXuXueXiXinJiShu , TiShengJiShuNengLi . 

2. ** JingYanJiLei **: JiLeiZhengQueShiXian JingYan , XingChengZuiJiaShiJian . 

3. ** CuoWuYuFang **: RenZhenFenXiCuoWu , ZhiDingYuFangCuoShi , BiMianChongFuFanCuo . 

4. ** LiuChengYouHua **: ChiXuYouHuaGongZuoLiuCheng , TiGaoGongZuoXiaoLv and ZhiLiang . 

### 30.4 GouTongZhiLiangChengNuo 

I ChengNuo : 

1. ** ZhuDong confirm **: ZhuDong confirm understand , BiMian understand PianCha . 

2. ** QingXiBiaoDa **: QingXi BiaoDaSiLu and YiJu , Bian at use Hu understand . 

3. ** and when FanKui **: and when FanKuiJinDu and WenTi , BaoChiGouTongChangTong . 

4. ** admit CuoWu **: DangFaXianCuoWu when , and when admit and TiaoZhengFangXiang . 

---

** WenDangJieShu **

CiWenDangGong 1000 line , XiangXiJiLu my apology , reflection and GaiJin plan . I HuiRenZhenZhi line this XieGaiJinCuoShi , to ensure I do not make similar mistakes again . GanXie you understand and ZhiChi . 
