# technical note : FLOW_ARCHITECTURE_DIRECTORY, rosbot_flow_f4_close_d3_send_f7, event_manager, i18n_errors_en, _obsolete_comprehensive_state_manager

** Mu **: note CiWuChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/FLOW_ARCHITECTURE_DIRECTORY.md`
- `d3utils/rosbot_flow_f4_close_d3_send_f7.py`
- `controller/d4func/events/event_manager.py`
- `providor/i18n/i18n_errors_en.json`
- `utils/_obsolete_comprehensive_state_manager.py`

---

## Yi , docs/FLOW_ARCHITECTURE_DIRECTORY.md

### 1.1 ZhiZe and YueDing 

- ** purpose **: DingYi d3-check ** LiuCheng architecture **: ** JinLiang LiuChengKu ** (BN-only, Flow-master) , directory BuJu , BiMianChongFuDingYi . Tick RuKou `rosbot_task_processor.process_task` An flow_state Diao use `tick_bn_only_flow()` and `tick_flow_master()`; ** LiangLiuChengKe in TongYi 2s tick within Tong when Yun line ** ( ShunXu : Xian BN-only, Zai flow-master) . **rosbot_flow_state** JinChi flow_master_enabled, bn_only_enabled; **flow_bn_only_state** ChiSuo have BN step and ZhuangTai (BNStep/BNNode, BNOnlyState) ; **flow_bn_only** for BN-only tick QuDong ; **flow_master_driver** for Flow-master tick and step / JieGuoZhuangTai ; **rosbot_flow_battlenet** for No. SanFang , JinTongGuo flow_bn_only_state DuXie , not Chi have BN step or ZhuangTai . 
- ** YueDing **: BNStep/BNNode, BN ZhuangTai (current_step, b5_entry_reason, wait_until etc. ) ** JinCun in at flow_bn_only_state**; rosbot_flow_battlenet not DingYi BNNode or this _current_node etc. ; reset_confirmed_to_poll, enter_battlenet_at_b2, set_battlenet_tick_confirmed, get_bn_flow_ever_confirmed etc. in flow_bn_only_state ShiXian ; rosbot_flow/ Xia for LiuChengKu (tick QuDong + GongXiangZhuangTai ) , DingCeng rosbot_flow_*.py for F block /BN step ShiXian . and FLOW_IMPLEMENTATION_PROGRESS, ENSURE_BATTLENET_ONLY_TICK_FLOW YiZhi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in rosbot_flow_battlenet within DingYi BNStep/BNNode or this BN ZhuangTai **: WenDangMingQueDanYuanZhenXiang in flow_bn_only_state, if in battlenet within FuZhiHuiChongFuDingYi and 4 ChongTu . 
2. ** JiaDingLiangLiuChengHuChi **: WenDangMingQueLiangKaiGuanKeTong when for True, Tong tick Xian BN-only Zai flow-master; if JiaHuChi or GaiShunXuHuiWeiFan 7. 
3. ** in rosbot_task_processor within ZhiJieDiao use refresh/notify to Wai No. SanFang **: Tick RuKouZhiDiao tick_bn_only_flow/tick_flow_master, not ZhiJieDiao No. SanFang ; if in process_task within ZengJia to battlenet_manager etc. ZhiJieDiao use HuiPoHuaiFenCeng . 
4. ** Jiang extension Jie segment DingYi in flow_master_driver**: extension Jie segment in extension_flow_state, flow_master_driver use of , no repetition DingYi . 

### 1.3 ZhengQueZuoFa 

- XiuGaiLiuCheng or BN ZhuangTaiQianXianDu this Wen and 25, 67; BN step and ZhuangTaiZhiFang in flow_bn_only_state; LiangLiuChengTong tick ShunXu not KeDianDao ; rosbot_flow_battlenet JinTongGuo flow_bn_only_state DuXie . 

---

## Er , d3utils/rosbot_flow_f4_close_d3_send_f7.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: **[F4]** F4a Guan D3, F4b XiangXiTongFa F7 Guan ROSBOT (ROSBOT_FLOW_MERMAID F block ) . `run_f4_close_d3_send_f7()`: `get_d3_manager().kill_if_running()`; `send_f7_to_system()`; `get_rosbot_manager().kill_if_running()`. ** Diao use FangSuiHouJinRu B2** ( such as enter_battlenet_at_b2) . no FanHuiZhi ; F3 FanHui "f4" when by flow_master_driver Diao use this HanShuZai enter_battlenet_at_b2. 
- ** YueDing **: Zhi line ShunXu for kill D3 send F7 kill ROSBOT; send_f7_to_system ShiBaiJinDa yellow not PaoYiChang ; not in CiHanShu within Diao use enter_battlenet_at_b2 ( by caller Diao ) . if DianDaoShunXu or in Ci within Diao enter_battlenet_at_b2 Hui and ROSBOT_FLOW_MERMAID and FLOW_IMPLEMENTATION_PROGRESS not YiZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Xian kill ROSBOT Zai kill D3 or Xian send F7**: WenDang and LiuChengTu for XianGuan D3, ZaiFa F7, ZaiGuan ROSBOT; if DianDaoKeNeng ROSBOT WeiShou F7 i.e. by kill. 
2. ** in this HanShu within Diao use enter_battlenet_at_b2**: YueDing for caller (flow_master_driver) in run_f4 HouDiao enter_battlenet_at_b2; if in Ci within DiaoHuiChongFu or LiuChengOuHe . 
3. ** to run_f4_close_d3_send_f7 JiaFanHuiZhi or item JianFenZhi **: DangQian for void, no FenZhi ; if Gai for GenJu kill/send JieGuo return HuiGaiBian flow_master_driver Diao use YueDing . 

### 2.3 ZhengQueZuoFa 

- BaoChi kill D3 send F7 kill ROSBOT ShunXu ; enter_battlenet_at_b2 by caller in run_f4 HouDiao use ; and ROSBOT_FLOW_MERMAID, FLOW_IMPLEMENTATION_PROGRESS YiZhi . 

---

## San , controller/d4func/events/event_manager.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: **D4 ShiJianGuanLiQi **. TongGuo **get_d4_interface_data()** and **D4_EVENT_KEYS** ( LaiZi share.game_interface_data) DuGongXiangShuJu ; no CanShuChuanRu , ShuJuZhiJieCongGongXiang within CunDu . **event_functions** Jiang D4_EVENT_KEYS value YingShe to Ge event HanShu (exp_farming_*, team_health_*, screen_*, game_state_*) . **check_state_changes()** Diao use _check_exp_farming_changes, _check_team_health_changes, _check_screen_changes, _check_game_state_changes, use **previous_states** ZuoBianGengJianCeHou trigger_event(event_key). DanLi get_event_manager(). 
- ** YueDing **: current_dir = Path(__file__).parent.parent.parent.parent (d4funcevents... project Gen ) ; D4State Yi and Ru D4InterfaceData, not DanDu use D4State; trigger_event JinDang event_key in event_functions within when Diao use to YingHanShu ; newly added ShiJianXu in D4_EVENT_KEYS and event_functions and to Ying _check_* in ZengJia . if in event HanShu within hardcode ShuJu and FeiCong get_d4_interface_data() DuHuiPoHuai " no CanShu , DuGongXiangShuJu " YueDing . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in trigger_event or event HanShu within ChuanRuFei key CanShu **: WenDangXie "No parameters are passed - data is read directly from shared memory"; if Gai for ChuanCanHui and D4InterfaceData DanLiDuFa not YiZhi . 
2. ** in event_manager within DingYi D4_EVENT_KEYS or ChongFuDingYi key**: D4_EVENT_KEYS DingYi in share.game_interface_data, CiChuJinYin use ; if in CiZhongDingYiHui and game_interface_data not Tong step . 
3. ** newly added ShiJianWeiTong step D4_EVENT_KEYS, event_functions, _check_* SanChu **: Hui Unknown event key or Yong not ChuFa . 
4. **_check_* within previous_states JianMing and d4_data ShuXing not YiZhi **: HuiJianCe not to BianGeng or WuChuFa . 

### 3.3 ZhengQueZuoFa 

- ShiJianShuJuZhiCong get_d4_interface_data() Du ; D4_EVENT_KEYS to game_interface_data for Zhun ; newly added ShiJian when SanChuTong step ; previous_states Jian and d4_data ShuXingYiZhi . 

---

## Si , providor/i18n/i18n_errors_en.json

### 4.1 ZhiZe and YueDing 

- ** purpose **: ** YingWenCuoWu / TiShiWenAn **. DangQian structure : **ui.error_messages.bag_offset_failed** = "Failed to update bag offset configuration". Gong i18n An key ( such as error_messages.bag_offset_failed or ui.error_messages.bag_offset_failed, Shi get_ui_text/translate QianZhuiYueDing ) QuWenAn . and i18n_common_zh, i18n_common_en etc. and Lie , Zhuan use at CuoWuLeiXiaoXi . 
- ** YueDing **: XiaoFeiFangTongGuo i18n get_ui_text or translate Qu key; if i18n_manager to error have DanDuQianZhui ( such as "ui." or "error_messages.") Xu and JSON structure YiZhi . newly added CuoWuWenAnXu in Ci and to YingYuYanWenJianTong when JiaJian ; GaiJianMingXuTong step Suo have Yin use Chu . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** JiaDing key LuJing for error_messages.bag_offset_failed and ShiJi for ui.error_messages.bag_offset_failed**: if get_ui_text Bu "ui." ZeChuan "error_messages.bag_offset_failed" i.e. Ke ; if translate not BuQianZhuiZeXuChuanWanZhengLuJing . 
2. ** ZhiGai i18n_errors_en WeiGai zh or Qi it YuYan **: Hui fallback to key or YingWen . 
3. ** ShanChu or ZhongMingMing bag_offset_failed WeiChaYin use **: HuiQu not to or XianShi key LuJing . 

### 4.3 ZhengQueZuoFa 

- newly added / XiuGaiCuoWuWenAn when Tong step GeYuYanWenJian and get_ui_text/translate key YueDing ; and i18n_manager prefix LuoJiYiZhi . 

---

## Wu , utils/_obsolete_comprehensive_state_manager.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi module ** (_obsolete_ QianZhui ) . ComprehensiveStateManager Chi RosBotState, BattleNetState, DiabloState, SystemRuntimeState, GameLogState, GameStatusState etc. dataclass, YiLai **providor_second.CONFIG, load_config**, Han update_rosbot_startup_status, update_battlenet_status, update_diablo_status etc. . ** not Ying by XinDaiMa or DangQianLiuChengYin use **; DangQianZhuangTai to game_interface_data, rosbot_flow_state, flow_bn_only_state, flow_master_driver etc. for Zhun . 
- ** YueDing **: not in CiWenJianKuoZhan ; not Jiang this module as ZhuangTaiGuanLi TuiJianShiXian ; if Xu ROSBOT/ ZhanWang /D3 ZhuangTaiYing use game_interface_data and LiuChengCengZhuangTai ; ShanChuQian confirm no Yin use . 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDangKe use ZhuangTaiGuanLiQi use **: WeiZhuYi _obsolete_ QianZhui and in Ci module ShangKaiFa or import, HuiYinRu providor_second, CONFIG and DangQianSheJi not YiZhi . 
2. ** and FLOW_ARCHITECTURE_DIRECTORY ChongTu **: WenDang in BN ZhuangTai in flow_bn_only_state, LiuChengZhuangTai in flow_master_driver; if use this WenJian ZhuangTaiHuiChongFu or and LiangLiuChengKuSheJiChongTu . 
3. **CONFIG Jian and DangQian config QianYi **: if CONFIG or load_config YiQianYi to providor_index or BieChu , this WenJianHui ImportError or DuCuo config . 

### 5.3 ZhengQueZuoFa 

- Shi this WenJian for ZhiDuLiShiCanKao ; not newly added YiLai , not in XinDaiMa in import; ZhuangTaiXuQiu to game_interface_data and LiuCheng architecture WenDang for Zhun ; ShanChuQianQuanJuSouSuo confirm no Yin use . 

---

## Liu , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuWuChuYueDing (FLOW_ARCHITECTURE_DIRECTORY LiangLiuCheng and directory and DanYuanZhenXiang , run_f4 ShunXu and caller Jin B2, event_manager no CanDu D4InterfaceData, i18n_errors_en JianLuJing , _obsolete_comprehensive_state_manager Wu use ) and in CiWuChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia to this Wen Yin use . 
