# technical note : _obsolete_tray_clicker, DengLuHou ZhanWangYuanSu - KongJian note , bn_flow_B5

** Mu **: note CiSanChuWenJian / ShuJu ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `utils/_obsolete_tray_clicker.py`
- `docs/ DengLuHou ZhanWangYuanSu - KongJian note .md`
- `.cache/bn_flow_snapshots/bn_flow_B5.json`

---

## Yi , utils/_obsolete_tray_clicker.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi module ** (_obsolete_ QianZhui ) . TrayIconClicker use **pywinauto Desktop(backend="uia")**, **win32api/win32con** MeiJuXiTongTuoPanXiangGuanChuangKou (class_name Han tray/notify/shell) , An keyword PiPei title/class_name, dual Ji No. Yi PiPeiTuBiao . ** use print() and Fei ColorPrint**. _normalize_keyword QuDiao .exe, LuJingQu basename. click_tray_icon(keyword) HuiJiLu and HuiFuShuBiao position Zhi . ** not Ying by XinDaiMa or DangQianLiuChengYin use **; DangQianTuoPan for ui/components/system_tray.py (pystray) , no " An keyword DianJiTuoPanTuBiao " to WaiNengLi . 
- ** YueDing **: not in CiWenJianKuoZhan ; not Jiang this module as TuoPanDianJi TuiJianShiXian ; if XuTuoPanJiaoHuYing to system_tray or event center for Zhun ; ShanChuQian confirm no Yin use . and system_tray pystray SheJi not Tong , this WenJian for JiuFangAn . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDangKe use GongJu use **: WeiZhuYi _obsolete_ QianZhui and in Ci module ShangKaiFa or import, HuiYinRu pywinauto, win32api and DangQian system_tray (pystray) SheJiChongTu . 
2. ** and system_tray HunXiao **: system_tray in TuoPanXianCheng within ChuangJian Icon, CaiDan and trigger_*; this WenJian for BianLiZhuoMianChuangKouZhao tray XiangGuan class and dual Dian ; if in " DianJiTuoPanTuBiao " XuQiuShangYin use this WenJianHuiWu use FeiQiShiXian . 
3. **print() and ColorPrint**: this WenJian use print DaRiZhi , and project pycore ColorPrint spec not YiZhi ; if in CiGai ColorPrint Reng not GaiBianFeiQiDing position . 
4. **keyword PiPei and tray ChuangKouMeiJu **: YiLai class_name Han tray/notify/shell, not TongXiTong or YuYanKeNeng no or Bian ; if DangWenDing API use Hui fragile. 

### 1.3 ZhengQueZuoFa 

- Shi this WenJian for ZhiDuLiShiCanKao ; not newly added YiLai , not in XinDaiMa in import; TuoPanJiaoHu to system_tray and event center for Zhun ; ShanChuQianQuanJuSouSuo confirm no Yin use . 

---

## Er , docs/ DengLuHou ZhanWangYuanSu - KongJian note .md

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** DengLuHouZhanWangJieMianKongJian note **. ShuJuLaiYuan : TiaoShiAnNiuDaoChu and FuZhi to `docs/ DengLuHou ZhanWangYuanSu .json` (UI Automation, Chromium ZhanWang ) . ** Yi use KongJian (BattlenetOperation) **: D3 YouXi Tab XiaoAnNiu automation_id `game-nav-btn-D3CN`, TabItemControl "Diablo III"; KaiShiYouXiAnNiuQuYu `play-btn-main`/`play-btn`, GroupControl, within Ceng ButtonControl "Playing Now: Diablo III" when is_enabled=false BiaoShiYouXi in . ** PanDuanLuoJi **: name Han "Playing Now"/"Play"/" KaiShiYouXi ", if is_enabled for False or name Han "Playing Now" ZeShi for YouXi in . ** DaiShiXian **: TongYiDengLu , DianJi confirm DengLu , is FouChu in DengLuJieMian , is FouYiJingDengLu . BattlenetAsiaOps _load_asia_features_from_docs_json KeNengCong docs/ DengLuHou ZhanWangYuanSu .json Chou D3 tab/Play automation_id and name (BATTLENET_REGION_DESIGN_REVIEW 3.2) . 
- ** YueDing **: JSON and this WenDangTong step ; Yi use KongJianBiao and BattlenetOperation/BattlenetRegionJudge ChaZhaoLuoJiYiZhi ; if Gai automation_id or name XuTong step app_constants or JSON and this WenDang . DaiShiXian item if ShiXianXu in WenDang in GengXin " Yi use KongJian " or PanDuanLuoJi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Gai JSON WeiTong step this md or Gai md WeiTong step JSON**: ShuJuLaiYuanXieMingDaoChu to DengLuHou ZhanWangYuanSu .json; if ZhiGaiQiYiHuiWenDang and ShuJu not YiZhi . 
2. ** Yi use KongJian and DaiMa in constants not YiZhi **: game-nav-btn-D3CN, play-btn-main/play-btn etc. if in app_constants or Judge in hardcode , Gai this WenDangWeiTong step DaiMaHuiZhaoCuoKongJian . 
3. ** PanDuanLuoJi "Playing Now / is_enabled=false" and Judge or Operation ShiXian not Fu **: if DaiMa in Gai for Qi it item JianWeiTong step this WenDangHuiWenDangShiXiao . 
4. ** DaiShiXian item and YiShiXianHunXiao **: TongYiDengLu , is FouChu in DengLuJieMian etc. for DaiShiXian ; if in BieChuYiShiXianXu in this WenDangGengXin , FouZeHouXuWeiHuZheWu to for WeiZuo . 

### 2.3 ZhengQueZuoFa 

- XiuGaiZhanWangKongJian or PanDuanLuoJi when Tong step this WenDang and DengLuHou ZhanWangYuanSu .json, app_constants, BattlenetOperation/Judge; Yi use KongJianBiao and DaiMaYiZhi ; DaiShiXianShiXianHouGengXinWenDang . 

---

## San , .cache/bn_flow_snapshots/bn_flow_B5.json

### 3.1 ZhiZe and YueDing 

- ** purpose **: **BN LiuCheng B5 JieDianKuaiZhao **. structure : **meta** (node="B5", reason="B5_exit") + **controls** ShuZu (name, automation_id, type, rect, level) . and bn_flow_B9, B4, BN_LoginAsia etc. structure YiZhi , GongTiaoShi or flow XiaoFei . **meta.node Xu and BN JieDianMingYiZhi ** ( such as B5 to Ying BN Liu B5 JieDian ) ; reason for B5_exit BiaoShiTuiChuXiangGuan . 
- ** YueDing **: XiaoFeiFangKeNengYiLai meta.node, meta.reason, controls name/automation_id/type/rect/level; if Gai meta or controls structure Xu confirm Suo have DuQuFang ; QingLi .cache or ShanKuaiZhaoQianXu confirm no YiLai . and FLOW_ARCHITECTURE_DIRECTORY, rosbot_flow_battlenet BN JieDianMingMingYiZhi . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDang config or LiuChengDingYiXiuGai **: this WenJian for MouCi B5 JieDianXia UI KuaiZhao , FeiLiuChengLuoJiDingYi ; Gai JSON not YingXiangLiuCheng line for , LiuChengLuoJi in flow DaiMa in . 
2. **meta.node and BN JieDianMing not YiZhi **: if flow or TiaoShiGongJuAn meta.node to YingJieDian , Gai node WeiTong step flow Hui to ZhaoCuo position . 
3. **controls structure BianGeng **: if FenXiGongJuShengJiGai controls item ( such as ZengShan char segment , Gai rect structure ) , XiaoFeiFangWeiTong step Hui KeyError or JieXiCuo . 
4. **.cache directory QingLi **: if WuShan bn_flow_snapshots or this WenJianHuiDiuShi B5 KuaiZhao , TiaoShi or HuiFangKeNengYiLai ; ShanChuQian confirm no Yin use . 

### 3.3 ZhengQueZuoFa 

- Shi this WenJian for B5 JieDianKuaiZhao ; XiaoFei when confirm meta.node and BN JieDianYiZhi ; XiuGai controls structure when Tong step Suo have DuQuFang ; QingLi .cache Qian confirm no YiLai . 

---

## Si , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuSanChuYueDing (_obsolete_tray_clicker Wu use , and system_tray QuFen ; DengLuHou ZhanWangYuanSu - KongJian note and JSON and BattlenetOperation Tong step ; bn_flow_B5 for KuaiZhao , meta.node and BN YiZhi ) and in CiSanChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia to this Wen Yin use . 
