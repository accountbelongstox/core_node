# technical note : providor/constants/d4, rosbot_flow_state, COORDINATE_SCALE_SPEC, bn_flow_B8, FLOW_STATE_OWNERSHIP_DESIGN

** Mu **: note CiWuChuWenJian ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . ** XiuGaiQianQingXianTongDu this note . **

** She and WenJian **: 
- `providor/constants/d4.py`
- `d3utils/rosbot_flow_state.py`
- `docs/COORDINATE_SCALE_SPEC.md`
- `.cache/bn_flow_snapshots/bn_flow_B8.json`
- `docs/FLOW_STATE_OWNERSHIP_DESIGN.md`

---

## Yi , providor/constants/d4.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: D4 Zhuan use ChangLiang ; Suo have FuHao for D4_* or Diablo IV XiangGuan . D4_STANDARD_RESOLUTION_WIDTH/HEIGHT (17631126) , D4_SCREENSHOT_DIR/D4_ANNOTATED_DIR ( Ji at TMP_DIR) , D4_TAB_*, D4_START_GAME_* (CN and Asia LiangTao automation_id/name_keywords) , D4_TICK_INTERVAL (3.0) , D4_EVENT_KEYS ( ShiJianMing event center use Jian ) . DaoRu : `from providor.constants.d4 import D4_TICK_INTERVAL, D4_SCREENSHOT_DIR` etc. . 
- ** YueDing **: D4_EVENT_KEYS key for ShiJianMing , value for event center DingYue use ; ZengShan or GaiMingXu and d4_extension_thread, exp_farming, event center ZhuCeChuTong step ; D4_TAB_* / D4_START_GAME_* and rosbot_ui_structure, operate_by_spec etc. BN/D4 KongJianChaZhaoYiZhi ; TMP_DIR LaiZi common, Wu in d4.py within ZhongDingYi . 

### 1.2 YiCuoDian 

- Gai D4_EVENT_KEYS key Wei and event center DingYue / FaBuChuTong step HuiDaoZhiShiJianShou not to or key Cuo ; Gai D4_TICK_INTERVAL Wei and d4_extension_thread tick JianGeYiZhiHuiJieZouCuo ; Gai D4_SCREENSHOT_DIR/D4_ANNOTATED_DIR Wei and d4_controller, exp_farming XieRuLuJingYiZhiHuiXieCuo directory . 

### 1.3 ZhengQueZuoFa 

- ZengShan D4_* ChangLiangQian grep XiaoFeiZhe (d4_controller, exp_farming_manager, event center, rosbot_flow in D4 XiangGuan ) ; Gai D4_EVENT_KEYS Bi and FaBu / DingYueFang to Zhao ; LuJingLeiChangLiang and common.TMP_DIR and ShiJiXieRuChuYiZhi . 

---

## Er , d3utils/rosbot_flow_state.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: LiuChengZhuangTaiDanYuanZhenXiang (FLOW_STATE_ARCHITECTURE) ; Chi have _flow_master_enabled, _bn_only_enabled; TiGong get_flow_master_enabled(), get_bn_only_enabled(), is_flow_active(); Jin set_flow_master_enabled(), set_bn_only_enabled() KeXie , QieXie when Tong step to game_interface_data (get_game_interface_data().set_rosbot_flow_master_enabled / set_ensure_battlenet_only_master_enabled) . ZhuangTaiBianGeng when LiuChengKongZhiLeiTiaoGuoLuoJi ; tick ShiZhongYun line , not Guan task. 
- ** YueDing **: ** Jin panel TongGuo set_* Xie ; process_task, check_window, BN Liu etc. JinTongGuo get_* Du **. Qi it LeiKu (provider, BN JieDian , F0/F3/F4, extension_flow_tick_step) not Du flow_master/bn_only ZuoFenZhiPanDuan (FLOW_STATE_OWNERSHIP_DESIGN) ; LiWaiJin BN Liu within no_activate Xia use HuGuanBi " QueBaoZhanWang " KeDu get_bn_only_enabled() use at TiQian abort. 

### 2.2 YiCuoDian 

- in process_task, provider, run_f0, extension_flow_tick_step etc. within Du get_flow_master_enabled()/get_bn_only_enabled() Zuo " is FouZhi line " FenZhiZePoHuaiDanYuan and SheJi ; in Fei panel ChuDiao use set_flow_master_enabled/set_bn_only_enabled HuiPoHuaiSuo have Quan ; Gai set_* when WeiTong step game_interface_data HuiDaoZhi UI and ZhenShiZhuangTai not YiZhi . 

### 2.3 ZhengQueZuoFa 

- XiuGaiQianBiDu docs/FLOW_STATE_OWNERSHIP_DESIGN.md; Jin rosbot_extension_panel ( or etc. Jia panel ) Diao use set_*; FenZhiPanDuanTongYi use get_*, QieJin in process_task/check_window etc. LiuChengRuKouChuDu ; not in CiWenJianWai newly added to _flow_master_enabled/_bn_only_enabled Xie . 

---

## San , docs/COORDINATE_SCALE_SPEC.md

### 3.1 ZhiZe and YueDing 

- ** purpose **: ZuoBiao and SuoFang ZuiXinSuanFa spec . TongYiGuiZe : ** XianJianBianKuang ( Zhuan content-space) An content ratio SuoFang ZaiJiaHuiBianKuang ( ZhuanShiJiWaiXiangSu ) **. Frame GuDing (8,8,31,8); Jin within RongQuCan and SuoFang . BiaoZhunWaiChiCun ( within Rong 1300800 when ) for 1316839. 
- ** YueDing **: ZuoBiaoHuanSuanGongShi scaled_x = (std_x - 8) * scale_x + 8, scaled_y = (std_y - 31) * scale_y + 31; PianYi use scale_standard_value_to_actual(value, scale, border); ShiXianChu for calculate_unified_scaled_coordinate() (windowed LuJing ) , scale_standard_value_to_actual(); BeiBaoQuYu to BiaoZhunWaiKongJian (925,445),(1297,665) etc. CunChu , SuoFangJin in scale method within Zuo subtract/scale/add-back. QuanPing no frame, scaled = std * scale. 

### 3.2 YiCuoDian 

- WeiXianJianBianKuang i.e. SuoFang or Wei in ZuiHouJiaHuiBianKuangHuiDaoZhiZuoBiao / PianYiCuo position ; Gai WINDOW_BORDER_* or TITLE_BAR_HEIGHT Wei and calculate_unified_scaled_coordinate, scale_standard_value_to_actual and Suo have Diao use FangTong step HuiJieMianCuo ; Ba " BiaoZhunKongJian " Dang " within RongKongJian " or Fan of HuiSuanCuo . 

### 3.3 ZhengQueZuoFa 

- GaiRenHeZuoBiao / SuoFang / BianKuangXiangGuanLuoJiQianTongDu this spec; Suo have She and ChuangKouZuoBiao , offset, BeiBaoQuYuChuJunZunXun subtract border scale add border back; GaiChangLiangXu and ShiXian and spec Tong step . 

---

## Si , .cache/bn_flow_snapshots/bn_flow_B8.json

### 4.1 ZhiZe and YueDing 

- ** purpose **: BN JieDian B8 KuaiZhao ; structure for meta (node="B8", reason="B8_to_B9") + controls ( this WenJianKe for KongShuZu []) . and bn_flow_B5, B9 etc. TongLei ; use at TiaoShi / HuiFang , FeiLiuChengLuoJiShuJuYuan . 
- ** YueDing **: meta.node Xu and BN JieDianMingYiZhi (B8) ; XiaoFeiFangKeNengYiLai meta.node, meta.reason, controls; Wu in flow FenZhi in Du this WenJianZuoJueCe ; Gai structure or Qing .cache Xu confirm YiLai ( such as unified_styles technical note in bn_flow_B8 YueDing ) . 

### 4.2 YiCuoDian 

- WuDangLiuChengDingYiGai or in CiWenJianXieYeWuLuoJi ; meta.node and BN JieDianMing not YiZhiHui to ZhaoCuo ; controls for Kong and B5 etc. FeiKong structure not Tong , JieXi when XuRongCuo ; Shan .cache Wei confirm is Fou have DaiMaYiLaiKuaiZhaoLuJing or structure . 

### 4.3 ZhengQueZuoFa 

- ShiZuo B8 JieDianKuaiZhao ; meta.node and BN YiZhi ; Gai structure or QingHuanCunQian grep YiLai ; not in LiuChengFenZhi in Du this WenJian . 

---

## Wu , docs/FLOW_STATE_OWNERSHIP_DESIGN.md

### 5.1 ZhiZe and YueDing 

- ** purpose **: LiuChengZhuangTaiSuo have QuanSheJiFangAn . key points : LiuChengLeiKuDingYi and Chi have flow_master, bn_only and step / JieDianZhuangTai ; Qi it LeiKu not Chi have , not DuLiuChengKaiGuanZuoFenZhi ; Qi it LeiKuFanHuiMingQueJieGuo (True/False or "confirmed", "b1" etc. ) ; LiuChengGenJuFanHuiZhiGengXinZhuangTai and step ; Tick ZhiQuDongLiuChengLeiKu (process_task) . ZhuangTaiGuiShu : flow_master_enabled, bn_only_enabled Cun at rosbot_flow_state, panel TongGuo set_* Xie , process_task/check_window/BN LiuTongGuo get_* Du ; game_interface_data Liang item JinLiuCheng set when XieRu , use at UI ZhanShi . 
- ** YueDing **: DaiMa position ZhiSuCha : LiuChengZhuangTai API in d3utils/rosbot_flow_state.py; BN-only in flow_bn_only.py; Tick RuKou and FenZhi in rosbot_task_processor.process_task(); panel in rosbot_extension_panel JinTongGuo flow_state get/set; check_window use is_flow_active(). and ENSURE_BATTLENET_ONLY_TICK_FLOW YiZhi . 

### 5.2 YiCuoDian 

- in provider, battlenet_status_provider, run_f0, extension_flow_tick_step etc. within Du flow_master/bn_only ZuoFenZhi i.e. WeiFanSheJi ; in LiuChengWaiXie flow_master_enabled/ensure_battlenet_only_master_enabled ( such as Xie game_interface_data GaiLiang item ) HuiPoHuaiDanYuan ; Gai this WenDangWeiTong step rosbot_flow_state, process_task, panel and ENSURE WenDangHuiWenDang and ShiXian not Fu . 

### 5.3 ZhengQueZuoFa 

- XiuGaiLiuChengXiangGuanDaiMaQianBiDu this WenDang ; Fan " is FouPaoLiuCheng " FenZhiJinDu rosbot_flow_state get_*; FanXieLiuChengKaiGuanJinTongGuo set_flow_master_enabled/set_bn_only_enabled; by Diao use FangZhiFanHuiJieGuo , not XieLiuChengZhuangTai . 

---

## Liu , WuChuJiaoChaZhuYi 

- **d4.py** and d4_extension_thread, exp_farming, event center YiZhi ; **rosbot_flow_state** and FLOW_STATE_OWNERSHIP_DESIGN for TongYiSheJi LiangMian ( DaiMa and WenDang ) , GaiQiYiXuTong step LingYi ; **COORDINATE_SCALE_SPEC** and calculate_unified_scaled_coordinate, scale_standard_value_to_actual, BeiBaoQuYuCunChuYiZhi ; **bn_flow_B8.json** and BN JieDian B8, KuaiZhaoXiaoFeiFangYiZhi ; **FLOW_STATE_OWNERSHIP_DESIGN** and rosbot_flow_state, process_task, panel , ENSURE_BATTLENET_ONLY_TICK_FLOW YiZhi . XiuGaiQianQingXianTongDu this note and ShangShuWuChuWenJian and to YingXiaoFeiZhe . 
