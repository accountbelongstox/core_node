# technical note : d3_start_game_and_teleport_waiter.py, D3_D4_NAMING_AND_LAYOUT.md, status_provider_common.py

** Mu **: note you ZhiDingChaYue to XiaSanChuWenJian ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `d3utils/d3_start_game_and_teleport_waiter.py`
- `docs/D3_D4_NAMING_AND_LAYOUT.md`
- `d3utils/status_provider_common.py`

---

## Yi , d3utils/d3_start_game_and_teleport_waiter.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: D3 QiDong and ChuanSongLiuCheng , to Ying ROSBOT_FLOW_MERMAID.md C FenZhi . C5/C5w (Start Game DianJi and etc. Dai game_tool) , C6 (game_tool LuJing ) , C7a/C7w/C7b ( An M DaKai Tu , 2s etc. Dai , SuoXiao + ChuanSongSanJi ) , C8; C10 Jin use at ** DiaoXianJianCe ** ( JieTu ( Qian ) Fa M JieTu ( Hou ) XiangSiDu to Bi , and C7 DaKai TuChuanSong for ** LiangTaoLuoJi **) . capture_and_detect_all_d3_states YiCiJieTuPiPei disconnected/start_game_button/game_tool/connecting; detect_d3_already_running_state FanHui "disconnect"|"start"|"game_tool"|"wait"|None. step_c7b_minimize_only / step_c7b_teleport_only FenPaiZhi line ; _do_c7b_teleport for YiCiZhi line SuoXiao + ChuanSong (legacy) . YiLai D3 ChangLiang (D3_MAP_MINIMIZE_CLICK, D3_TELEPORT_CLICK, D3_TELEPORT_CLICK_2, C7B_*, D3_START_GAME_* etc. ) , get_d3_scaled_template_matcher, get_screenshot_provider, calculate_unified_scaled_coordinate, get_game_interface_data().is_windowed_mode(), WindowFinder, ClickHandler, window_send_key(VK_M). 
- ** YueDing **: Gai C block LuoJiXu to Zhao ROSBOT_FLOW_MERMAID and ROSBOT_FLOW_C_BLOCK WenDang , BaoChiJieDian and DaiMa 1:1; C10 and C7 not KeHunXiao (C10 PanDiaoXian , C7 ChuanSongQianKai Tu ) ; state_dict key (disconnected, start_game_button, game_tool, connecting) and d3_status_provider._detect_d3_dynamic, match_all_d3_states YiZhi . XiangJian this directory ** technical note _INITIAL_STATE_DETECTION and d4_modules_README and _obsolete_play_button_clicker and ROSBOT_FLOW_C_BLOCK and bn_flow_B9.md** etc. . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **C10 and C7 HunXiao **: C10 for M QianHouJieTuXiangSiDuPanDiaoXian ; C7 for An M Kai Tu , XuanShangJinDuJianCe , C7b SuoXiao + ChuanSong . if in C7 in Fu use C10 step_c10_* or Fan of , YuYiCuo . 
2. **step and blocking Hun use **: tick Liu use step_c7a_send_m, step_c7b_minimize_only, XiaYiPai step_c7b_teleport_only; blocking use _run_c7a_c7w_c7b, send_m_then_teleport_three_clicks, wait_for_game_tool_then_send_m_and_click. if in tick in Diao blocking HuiKaZhuZhuXunHuan . 
3. **state_dict and detect_d3_already_running_state FanHuiZhi **: state_dict LaiZi matcher.match_all_d3_states; FanHuiZhi "disconnect"/"start"/"game_tool"/"wait"/None and LiuChengFenZhi to Ying , if Gai key or FanHuiZhiWeiTong step flow or d3_status_provider HuiCuo . 
4. ** ChangLiang and ZuoBiao **: D3_MAP_MINIMIZE_CLICK, D3_TELEPORT_CLICK, D3_TELEPORT_CLICK_2 etc. LaiZi providor.constants.d3; calculate_unified_scaled_coordinate Xu game_window_size, standard_resolution, is_windowed; if ChangLiangGaiMing or ZuoBiaoXiBianGengWeiTong step HuiDianCuo . 
5. **_c10_img_a QuanJu **: step_c10_send_m CunTu , step_c10_compare DuTu , TongLiuChengTongXianCheng ; if DuoXianCheng or KuaLiuChengFu use HuiChuanTu . 

### 1.3 ZhengQueZuoFa 

- XiuGaiQianTongDu ROSBOT_FLOW_MERMAID C FenZhi and this WenDangTouBuZhuShi ; QuFen C10 ( DiaoXian ) and C7 ( ChuanSong ) ; QuFen step_* ( DanPai ) and blocking HanShu ; Gai state_dict key or detect_d3_already_running_state FanHuiZhiXuTong step flow and d3_status_provider; ChangLiang and ZuoBiao to providor.constants.d3 and get_game_interface_data for Zhun . 

---

## Er , docs/D3_D4_NAMING_AND_LAYOUT.md

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** ZhongDingXiang note **, ShengMing D3/D4/ Gong use QuSheJiMingMing spec YiZhengHe to `docs/PROJECT_STANDARDS.md` San . this WenJianJinLiang line , not BaoHanJuTi spec within Rong , QuanWei within Rong in PROJECT_STANDARDS.md. 
- ** YueDing **: She and D3/D4 MingMing , directory GuiShu , ChangLiang and module MingMing , DaoRuGuiZe when to PROJECT_STANDARDS.md San for Zhun ; if PROJECT_STANDARDS ChongZuZhangJie , this WenJianYin use " San " KeNengShiXiao , XuTong step GengXin this WenJian or PROJECT_STANDARDS directory / MaoDian . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** San and PROJECT_STANDARDS ShiJi structure TuoJie **: if PROJECT_STANDARDS in D3/D4 MingMing and BuJuYiYi to Qi it ZhangJie or ChaiChengDuoJie , this WenJianRengXie " San " HuiDaoZhiZhiXiangCuoWu . 
2. ** in this WenJian within XieJuTi spec **: this WenJianYing for ZhongDingXiang , if in CiXieMingMingXiZeHui and PROJECT_STANDARDS ChongFu or ChongTu , ZaoCheng " to NaFen for Zhun " KunHuo . 
3. ** ShanChu this WenJian **: BaoLiu this WenJianMingBian at SouSuo "D3 D4 naming layout"; if ShanChuZeXu in Qi it WenDang or README in ZhuMing spec Jian PROJECT_STANDARDS. 

### 2.3 ZhengQueZuoFa 

- XiuGai D3/D4 MingMing or directory spec when XianGai PROJECT_STANDARDS.md, ZaiHe to this WenJian " San " is FouRengZhengQue ; not in this WenJian within XieJuTi spec ; if PROJECT_STANDARDS ZhangJieBianHaoBianGengXuTong step this WenJianYin use . 

---

## San , d3utils/status_provider_common.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** ZhuangTaiTiGongFangGong use ShuaXinLiuCheng **. refresh_window_state(game_data, window_info_or_none, *, set_running_fn, set_dynamic_fn, detect_dynamic_fn, apply_geometry_fn=None, log_prefix=""): Xian set_running_fn(game_data, found), ZaiKeXuan apply_geometry_fn(game_data, window_info_or_none), Zai detect_dynamic_fn(found, window_info_or_none) (on_login, disconnected, third), Zai set_dynamic_fn(game_data, on_login, disconnected, third). by **battlenet_status_provider** and **d3_status_provider** use , ErZheZhuRuGeZi set_running_fn, set_dynamic_fn, detect_dynamic_fn, apply_geometry_fn. 
- ** YueDing **: Si HuiDiao QianMing not KeGai : set_running_fn(Any, bool), set_dynamic_fn(Any, bool, bool, bool), detect_dynamic_fn(bool, Optional[Dict]) -> Tuple[bool, bool, bool], apply_geometry_fn(Any, Optional[Dict]); if Gai refresh_window_state CanShuShunXu or HuiDiaoQianMingWeiTong step LiangChu provider HuiBaoCuo or line for Cuo . YiChang when set_dynamic_fn(..., False, False, False). 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Gai refresh_window_state QianMing **: if ZengShanCanShu or GaiHuiDiaoShunXu , battlenet_status_provider and d3_status_provider Diao use ChuXuTong step , FouZe TypeError or ChuanCuoCanShu . 
2. **detect_dynamic_fn FanHuiSanYuanZuHanYi **: (on_login, disconnected, third) by Ge provider Zi line DingYi ; d3_status_provider DangQian for (False, disconnected, False). if JiaDing on_login or third in Ci for True or GaiFanHuiChangDuWeiTong step set_dynamic_fn JieShouHuiCuo . 
3. **apply_geometry_fn KeXuan **: if Mou provider not Chuan apply_geometry_fn, ZeZhiZuo set_running, detect_dynamic, set_dynamic; if in common within JiaDing apply_geometry_fn BiCun in Hui AttributeError. 
4. ** YiChangChuLi **: detect_dynamic YiChang when Yi set_dynamic_fn(game_data, False, False, False); if in common within ZengJiaQi it fallback Wei and Liang provider YueDingHuiZhuangTai not YiZhi . 

### 3.3 ZhengQueZuoFa 

- XiuGai refresh_window_state or RenYiHuiDiaoQianMingQianBiXuTong step battlenet_status_provider and d3_status_provider; Ge provider detect_dynamic_fn FanHui (on_login, disconnected, third) HanYi to Ge provider WenDang for Zhun ; Wu in common within JiaDing apply_geometry_fn BiCun in . XiangJian this directory ** technical note _d3_status_provider and battlenet_operation and map_name_recognizer and system_tray.md**, ** technical note _template_match_debug and rosbot_flow_f4 and d3_status_provider.md**. 

---

## Si , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuSanChuYueDing (d3_start_game_and_teleport_waiter C10/C7 FenLi , step and blocking QuFen , state_dict and ChangLiang ; D3_D4_NAMING_AND_LAYOUT for ZhongDingXiangQie San Xu and PROJECT_STANDARDS YiZhi ; status_provider_common HuiDiaoQianMing and Liang provider ZhuRu ) and in CiSanChuFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md No. LiuShiSiJie in Yin use . 
