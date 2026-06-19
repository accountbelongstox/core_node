# technical note : bn_flow_B6.json, exp_farming_events.py, battlenet_ui_elements_asia_2.json, flow_bn_block_state.py

this note Zhen to to XiaSiChu : XiuGaiQianQingXianTongDu this note and to YingYuanMa / WenJian . 

- `.cache/bn_flow_snapshots/bn_flow_B6.json`
- `controller/d4func/events/exp_farming_events.py`
- `docs/battlenet_ui_elements_asia_2.json`
- `d3utils/rosbot_flow/flow_bn_block_state.py`

---

## Yi , .cache/bn_flow_snapshots/bn_flow_B6.json

- ** purpose **: BN LiuCheng B6 JieDianYun line when KuaiZhao ; meta.node "B6", meta.reason "B6_to_B13"; controls for ZhanWangChuangKou in GaiJieDian when KongJianLieBiao (name, automation_id, type, rect, level) ; by rosbot_flow_battlenet._save_ui_snapshot etc. XieRu ; and B4/B5/B7/B9 etc. structure YiZhi . 
- ** YueDing **: LuJingCong BN_FLOW_SNAPSHOTS_DIR and JieDianMingShengCheng , Wu hardcode bn_flow_B6.json or .cache Jue to LuJing ; controls structure and battlenet_region_judge, _load_login_failed_features_from_snapshots etc. YueDingYiZhi ; B6 Jin use at B6 XiangGuanLuoJi , Wu and B5/B7 etc. Hun use ; .cache for Yun line when ChanWu , WuDangQuanWeiTiJiao . 
- ** YiCuoDian **: hardcode LuJing or JieDianMingHuiHuanJieDian or QingHuanCunHouDu not to ; controls and battlenet_region_judge QiWang not YiZhiHuiDaoZhi B6B13 FenZhi or DengLuZhuangTaiWuPan ; use B6 KuaiZhaoZuo B7 LunXun or B4 ShouCiJianChaHuiWuPan ; meta Que node/reason when XiaYouKeNengWeiZuoJianRong . 
- ** ZhengQueZuoFa **: KuaiZhaoLuJingCong BN_FLOW_SNAPSHOTS_DIR and JieDianMingPinJie ; DuQu and battlenet_operation, battlenet_region_judge YueDingYiZhi ; XiuGaiQianQingXianTongDu this note and technical note _bn_flow_B6 and d4_controller and square_sampler and DESIGN_DETAIL.md. 

---

## Er , controller/d4func/events/exp_farming_events.py

- ** purpose **: EXP farming ShiJianHuiDiao ; on_exp_farming_started, on_exp_farming_stopped, on_exp_farming_tick_completed; no CanShu , ShuJuCong get_d4_interface_data() DuQu ; use at D4 JingYan farming ZhuangTaiBianHua when DaRiZhi or TongZhi . 
- ** YueDing **: All functions use shared data from D4InterfaceData and D4State; No parameters are passed - data is read directly from shared memory; get_d4_interface_data() LaiZi share.game_interface_data; ShiJianMing and D4_EVENT_KEYS or d4_extension_thread FaBu of key YiZhi ( such as EXP_FARMING_STARTED, EXP_FARMING_STOPPED) . 
- ** YiCuoDian **: GaiShiJianHanShuQianMing or JiaCanShuHuiPoHuaiDiao use Fang ( if Diao use Fang not ChuanCan ) ; Gai get_d4_interface_data FanHui structure or is_exp_farming_running(), timestamp etc. WeiTong step Hui AttributeError; ZengShanShiJianWei and FaBuFang (d4_extension_thread or event bus) Tong step HuiShiJian not ChuFa or key Cuo . 
- ** ZhengQueZuoFa **: ShiJianHuiDiaoBaoChi no Can , JinCong get_d4_interface_data() Du ; ZengShanShiJian when and D4_EVENT_KEYS, FaBuFangTong step ; XiuGaiQianQingXianTongDu this note and share.game_interface_data, d4_extension_thread. 

---

## San , docs/battlenet_ui_elements_asia_2.json

- ** purpose **: ZhanWangYaFuDengLuJieMian UI KongJianShuKuaiZhao ; Han timestamp, window_info (hwnd, title, left, top, width, height etc. ) , controls (id, parent_id, type, name, automation_id, class_name, rect, level etc. ) , files (screenshot, annotated_screenshot Jue to LuJing ) ; to YingYaFuDengLu Variant A (accountName, submit" JiXu ", login-header" DengRu ") . 
- ** YueDing **: and BATTLENET_ASIA_LOGIN_UI_AND_EXTENSION_PLAN or TongLei plan WenDang in automation_id/ MingChengYiZhi ; files in LuJing for Jue to LuJing , if by DaiMaDangKeYiZhiLuJingHui in Qi it HuanJingShiBai ; controls in rect and window_info BianJieYiZhi , BuFenKongJian rect KeNengChaoChuChuangKouXuCaiJian or JiaoYan . 
- ** YiCuoDian **: files use Jue to LuJing ( such as C:\Users\...\.core_node\.d3check\.cache\...) by DaiMa or WenDangDangKeYiZhiLuJingHui in it HuanJingShiBai ; BuFenKongJian rect.bottom Da at ChuangKou bottom i.e. ChaoChuChuangKouXiaBianJie , use at ZuoBiao or DianJiXuCaiJianFouZeYueJie ; KuaiZhao and plan WenDang in accountName, submit, login-header etc. JianMing not YiZhiHuiDaoZhiJianCeShiBai . 
- ** ZhengQueZuoFa **: YiLaiGai JSON when JianChaLuJingKeYiZhiXing , rect and ChuangKouBianJieYiZhiXing and and plan WenDangChangLiang / Jian to Ying ; XiuGaiQianQingXianTongDu this note and BATTLENET_ASIA_LOGIN_UI_AND_EXTENSION_PLAN etc. . 

---

## Si , d3utils/rosbot_flow/flow_bn_block_state.py

- ** purpose **: BN block ZhuangTai (B1..B16) LiangFenDuLiFu this ; for_bn_only=True use at tick_battlenet_ready_flow(no_activate=True) (BN-only flow) , for_bn_only=False use at tick_battlenet_ready_flow(no_activate=False) (Flow-master flow) ; BNStep MeiJu , BNBlockState dataclass, _block_bn_only/_block_flow_master, BNBlockCtx, get_bn_block_ctx(for_bn_only), get_current_step/set_current_step, wait_until, b7_poll_deadline, b13_poll_deadline, oauth_wait_until, reset_bn_block_state, reset_confirmed_to_poll, is_bn_flow_in_login_phase, enter_battlenet_at_b2 etc. . 
- ** YueDing **: BN JieDian and ZhuangTaiJinTongGuo this module DuXie , rosbot_flow_battlenet not DingYi _current_node etc. JuBuZhuangTai ; reset_bn_block_state(True) ZhongZhi BN-only block , reset_bn_block_state(False) ZhongZhi Flow-master block , WuChuanCuo ; Flow-master and BN-only KeTong when Yun line GuLiangFu this Hu not FuGai ; B7_TRIGGER_D_AFTER_SKIPS, B7_TRIGGER_D_COOLDOWN_SEC for B7 LunXunXiangGuanChangLiang . 
- ** YiCuoDian **: in rosbot_flow_battlenet or it ChuDingYi _current_node, _wait_until etc. JuBuZhuangTaiHui and flow_bn_block_state ZhiZeChongFu or not Tong step ; reset_bn_block_state(True) and reset_bn_block_state(False) HunXiaoHuiZhongZhiCuoLiuCheng ; get_current_step/set_current_step etc. XuChuan for_bn_only and tick Diao use Chu no_activate YiZhi ; Gai BNStep MeiJuWei and ROSBOT_FLOW_MERMAID, rosbot_flow_battlenet FenZhiTong step HuiLiuChengCuo . 
- ** ZhengQueZuoFa **: BN block ZhuangTaiJinTongGuo flow_bn_block_state DuXie ; reset when MingQue for_bn_only and Diao use FangYuYiYiZhi ; XiuGai BNStep or BNBlockState char segment when Tong step rosbot_flow_battlenet, FLOW_ARCHITECTURE_DIRECTORY; XiuGaiQianQingXianTongDu this note and technical note _flow_bn_only_state and ui_utils and map_name_recognizer.md, FLOW_ARCHITECTURE_DIRECTORY.md. 

---

## Wu , SiChu and apology document to Ying 

this note to YingZhuanShu apology document ** No. LiuShiJie ** and ZhangWen apology in " then bn_flow_B6, exp_farming_events, battlenet_ui_elements_asia_2, flow_bn_block_state SiChu " of FenXi and apology segment . FaXianShangShuSiChuWenJian when , Ying continue GengXin to apology document ( technical note , ZhuanShuJie , ZhangWenZhuiJia ) . 
