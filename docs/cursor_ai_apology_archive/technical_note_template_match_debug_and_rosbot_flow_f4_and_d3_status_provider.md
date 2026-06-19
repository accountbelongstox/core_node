# technical note : template_match_debug, rosbot_flow_f4_close_d3_send_f7, d3_status_provider

** Mu **: note this SanChuDaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `share/template_match_debug.py`
- `d3utils/rosbot_flow_f4_close_d3_send_f7.py`
- `d3utils/d3_status_provider.py`

---

## Yi , share/template_match_debug.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: MuBanPiPeiDiaoShiDuiLie -- Gong " Qi it TuXiangChaZhao " LeiTiaoShi UI use ; ** Jin within Cun **, not LuoPan . Matcher in every CiPiPeiHouTongGuo `notify_match()` XieRuYi item JiLu ( BiaoTi , RiZhi line , KeXuanBiaoZhuTu ) ; UI CeTongGuo `pop_all()` or `get_entries()` QuShuJuZhanShi ; GuanBiTiaoShi UI when Diao use `clear()` QingKongDuiLie and HuanCun . 
- ** ShengXiao item Jian **: JinDang `_ui_active` for True when `notify_match()` CaiHuiHuiZhi and push; by TiaoShi UI TongGuo `set_debug_ui_active(True/False)` KongZhi . if WeiXian set for True, matcher Diao use notify_match not HuiChanShengRenHeRuDui . 
- ** Diao use Fang **: ScaledTemplateMatcherBase in every CiPiPeiHouDiao use `notify_match(template_name, result, target_img_array, template_img_array, match_method, expected_threshold, first_match)`. result XuHan `total_matches`, `matches`, `error`; first_match KeXuanHan `num_matches`, `match_threshold` use at BiaoZhu Score. 
- ** HuiZhi **: _build_annotated_match_image use ImageAnnotator in target BGR ShangHua Mode, Threshold, Score, Result, Template Ming and MuBanSuoLveTu ; FanHui PIL Image. putText Jin ASCII, not ZhiChi Unicode. 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WeiJiHuo then QiWang have ShuJu **: if TiaoShi UI Wei in DaKai when Diao use `set_debug_ui_active(True)`, matcher Ce i.e. use notify_match also not Hui push; GuanBi when if not Diao use `set_debug_ui_active(False)` and `clear()`, XiaCiDaKaiKeNengDu to Jiu entries or DuiLieCanLiu . 
2. **result structure BianHua **: if matcher FanHui result not ZaiHan `total_matches`, `matches`, `error`, or first_match no `num_matches`/`match_threshold`, _build_annotated_match_image Score/Result line HuiCuo or BaoCuo . 
3. ** TuXiangGeShi **: target_img_array, template_img_array YueDing for BGR numpy; if ChuanRu RGB or PIL, cvtColor or shape HuiCuo ; notify_match WenDang or Diao use FangXuZunShou . 
4. ** DuiLie and _entries dual Xie **: push() Tong when put to _debug_queue and append to _entries; pop_all() ZhiCong queue Qu , get_entries() FanHui _entries Fu this . if MouChuZhi pop not QingLi _entries or ZhiQing _entries not Qing queue, Hui not YiZhi ; clear() YingTong when QingKongLiangZhe . 
5. ** DuoXianCheng **: queue.Queue for XianChengAnQuan , but _entries list in push when no Suo ; if DuoXianChengTong when push and clear, _entries KeNengJingTai ; TongChang matcher and UI in TongYiXianCheng or UI JinDu , XuYueDingDiao use XianCheng . 

### 1.3 ZhengQueZuoFa 

- TiaoShi UI DaKai when set_debug_ui_active(True), GuanBi when set_debug_ui_active(False) and clear(). 
- XiuGai matcher result or first_match structure when , Tong step GengXin _build_annotated_match_image key (total_matches, matches, error, num_matches, match_threshold) . 
- ChuanRu notify_match TuXiangBaoChi BGR numpy; not in template_match_debug within ZuoCiPan I/O. 

---

## Er , d3utils/rosbot_flow_f4_close_d3_send_f7.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ShiXian ROSBOT_FLOW_MERMAID in F4--F4a GuanBi D3 JinCheng , F4b XiangXiTongFaSong F7 to GuanBi ROSBOT, SuiHou ** by Diao use Fang ** JinRu B2_HasWin ( such as flow_master_driver in run_f4_close_d3_send_f7() Hou i.e. enter_battlenet_at_b2) . 
- ** ShunXu **: Xian `get_d3_manager().kill_if_running()`, Zai `send_f7_to_system()`, Zai `get_rosbot_manager().kill_if_running()`. ShunXu not KeDianDao : if XianSha ROSBOT ZaiFa F7 KeNeng no Xiao ; if Xian F7 ZaiSha D3 KeNeng ROSBOT WeiZhengQueShou F7. 
- ** no FanHuiZhi **: run_f4_close_d3_send_f7() no FanHuiZhi ; Diao use Fang not GenJuFanHuiZhiFenZhi , Zhi line Wan i.e. JinRu B2. 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DiaoHuanShunXu **: if Gai for Xian send_f7 Zai kill D3, or Xian kill rosbot Zai kill D3, Hui and WenDang F4aF4b and " XianGuan D3 Zai F7 ZaiGuan ROSBOT" YueDing not Fu , KeNengDaoZhi ROSBOT WeiTuiChu or F7 no Xiao . 
2. ** ShengLveMouYi step **: if for " ShengShi " ZhiSha D3 not Fa F7 or not Sha rosbot JinCheng , XiaYou B2 KeNengRengRen for ROSBOT in Pao , ZhuangTai not Tong step . 
3. ** in this module within Xie B2 LuoJi **: F4 JinFuZe " Guan D3 + F7 + Sha ROSBOT"; JinRu B2 (enter_battlenet_at_b2) in flow_master_driver in Diao use this HanShu of HouZhi line . if in this module within Xie enter_battlenet HuiYinRuXunHuanYiLai or ZhiZeHunLuan . 
4. **send_f7_to_system ShiBai **: DangQianShiXian F7 FaSongShiBaiJinDa yellow log, Reng continue kill rosbot; if XiWang "F7 ShiBaiZe not Sha rosbot" XuGaiLuoJi and WenDangHua , DangQian for " JinLiangFa F7, ZaiShaJinCheng ". 
5. ** ChongFuDiao use **: if flow LuoJiCuoWuDaoZhi run_f4 by DuoCiDiao use , HuiDuoCi kill ( TongChang no Hai ) ; but if Diao use FangYiLai " ZhiDiaoYiCi " JiaSheZuoZhuangTaiQingLi , Xu in Diao use FangBaoZheng . 

### 2.3 ZhengQueZuoFa 

- BaoChi "kill D3 send_f7_to_system kill rosbot" ShunXu ; not in this module within Diao use enter_battlenet or B block LuoJi . 
- XiuGai F7 ShiBai when line for ( such as not Sha rosbot) when , in module ZhuShi and ROSBOT_FLOW WenDang in note . 

---

## San , d3utils/d3_status_provider.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: D3 ChuangKouJianCe and DongTaiZhuangTaiShuaXin ; TongGuo `refresh_d3_status(skip_dynamic=False)` Zhao D3 ChuangKou , KeXuanZuoYiCiJiePing + MuBanPiPei (capture_and_detect_all_d3_states) to disconnected etc. , and GengXin game_interface_data (set_d3_status, set_d3_dynamic_status, geometry) . 
- **skip_dynamic**: True when JinZhaoChuang + Xie geometry, not JiePing , not Pao SIFT ( use at QiDong / ShouDongShuaXin etc. QingLiangShuaXin ) ; False when Zhi line _detect_d3_dynamic ( YiCi capture, state_dict in disconnected use at set_d3_dynamic_status) . LiuCheng in XuYao " is FouDiaoXian " when Ying use skip_dynamic=False. 
- **_detect_d3_dynamic FanHuiZhi **: SanYuanZu (on_login_screen, disconnected, in_game); DangQianShiXianJinGenJu state_dict["disconnected"] Tian (False, disconnected, False), on_login_screen and in_game Wei in CiChuFuZhi . if ShangYouYiLai this Liang item , Xu in capture_and_detect_all_d3_states or state_dict in TiGong and in CiChuChuanHui . 
- **refresh_window_state**: by status_provider_common TiGong ; this module ChuanRu set_running_fn, set_dynamic_fn, detect_dynamic_fn, apply_geometry_fn; detect Jin in skip_dynamic=False when Zhi line . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **skip_dynamic use Cuo **: if in XuYao " DiaoXian " PanDuan LiuChengLiChuan skip_dynamic=True, HuiYongYuan to (False, False, False), disconnected YongYuan not GengXin ; if in JinXu " have no have D3 ChuangKou " ShuaXinLiChuan skip_dynamic=False, HuiDuoZuoYiCiJiePing /SIFT, YanChi and KaiXiaoZengDa . 
2. **state_dict structure **: _detect_d3_dynamic YiLai capture_and_detect_all_d3_states FanHui state_dict Han "disconnected"; if d3_start_game_and_teleport_waiter in state_dict key GaiMing or Gai for QianTao , CiChuHuiQu not to or BaoCuo . 
3. **on_login_screen / in_game WeiShiXian **: DangQianZhiTian disconnected; if WenDang or Diao use FangJiaDing on_login_screen, in_game Yi in Ci provider in GengXin , HuiWu use . if XuZhiChi , Ying in _detect_d3_dynamic in Cong state_dict or capture JieGuoJieXi and FanHui . 
4. **prime_window_cache_for_capture**: Jin in skip_dynamic=False when Diao use ; if find_windows YiLaiHuanCun and skip_dynamic=True when Wei prime, KeNengZhaoChuang not Zhun ; DangQianSheJi is skip_dynamic when not Zuo capture Gu not prime, find_windows use d3_manager ZiJi HuanCunLuoJi , Xu and d3_manager YueDingYiZhi . 
5. **apply_geometry game_data ShuXing **: _apply_d3_geometry HuiXie fullscreen_size, window_offset, _window_hwnd, _window_title; if game_interface_data structure BianHua or Qi it module YiLai this Xie char segment MingMing , XuTong step . 

### 3.3 ZhengQueZuoFa 

- LiuCheng in XuYao "D3 is FouDiaoXian " when Diao use refresh_d3_status(skip_dynamic=False); JinZuo " have no ChuangKou + JiHe " when use skip_dynamic=True. 
- XiuGai capture_and_detect_all_d3_states state_dict structure when , Tong step Gai _detect_d3_dynamic QuZhi ; if ZengJia on_login_screen/in_game JianCe , in CiChuYi and FanHui and XieRu set_d3_dynamic_status. 
- and status_provider_common, d3_manager " ZhaoChuang / HuanCun / JiHe " YueDingBaoChiYiZhi , BiMianChongFu prime or Lou prime. 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as template_match_debug WeiJiHuo i.e. use , result structure GaiHuai , F4 ShunXu or step GaiCuo , d3_status_provider skip_dynamic or state_dict use Cuo ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for ShiXian and YueDing not YiZhiSuoZhi . this note YiXieRu `cursor_AI_ apology directory `, and in `Cursor_ ZhuanShu apology document .md` in ZengJia to this Wen Yin use , Bian at HouXuXiuGaiQianXianChaCiChuYueDing . 
