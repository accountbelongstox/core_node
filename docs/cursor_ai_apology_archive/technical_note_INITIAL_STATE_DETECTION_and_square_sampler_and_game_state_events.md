# technical note : INITIAL_STATE_DETECTION, square_sampler, game_state_events

** Mu **: note this SanChuWenDang / DaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/INITIAL_STATE_DETECTION.md`
- `athtest/square_sampler.py`
- `controller/d4func/events/game_state_events.py`

---

## Yi , docs/INITIAL_STATE_DETECTION.md

### 1.1 ZhiZe and YueDing 

- ** ZhuTi **: Ying use QiDong when ** JinZuoYiCi ** ChuShiZhuangTaiJianCe , use at DiBuLan etc. UI XianShi ZhanWang /ROS/D3/ Tu / Jie segment / ChuangKouChiCun etc. ZhenShiZhi ; this CiJianCe ** ZhiZuo detection, not QuDong flow** ( not Diao use tick_bn_only_flow, tick_flow_master) . 
- ** KeFu use RuKou **: `run_full_status_refresh()` (`d3utils/rosbot_task_processor.py`) FuZe Battle.net ( HanYaFu / GuoFu ) + D3 + ROSBOT ShuaXin and notify UI, ** not Zuo flow JianCha **. Shi use at : QiDong when , ShouDongShuaXin , or flow WeiJiHuo when Ding when ShuaXin . 
- ** LiuCheng **: 
1. UI then XuHou , Controller Diao use `get_thread_registry().start_timer_loop_after_ui_ready()` ( in `ui.run()` of Qian ) . 
2. `start_timer_loop_after_ui_ready()` ** Xian in ZhuXianChengTong step ** Zhi line `do_window_monitor_initial_check()`, this Yang in ShouZhenQian then WanCheng refresh and `notify_state_sync()`, UI HuiDiaoTongGuo `after(0, ...)` in ShouZhenXianShi . 
3. RanHouQiDong timer XunHuan and `submit_one_shot(do_window_monitor_initial_check)` ( Duan when Jian within ZaiPaoYiCi , no Hai ) . 
4. `do_window_monitor_initial_check()` ( in `timers/one_shot_tasks.py`) ** ZhiJieDiao `run_full_status_refresh()`**, Cong not Diao `check_window()`, because Ci and `is_flow_active()` no Guan , ShiZhongZhi line . 
5. of Hou `window_monitor.notify_window_callbacks(d3_info)` TongZhi D3 ChuangKouHuiDiao . 
- ** and 2s flow QuBie **: ChiXu 2s tick (flow QuDong ) by `process_task()` in flow JiHuo when Zhi line , ZhiDiao tick_bn_only_flow / tick_flow_master, ** not Can and ** CiCiChuShiJianCe . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** use flow Zuo " ChuShiJianCe "**: if in QiDong when for " ShengShi " ZhiJieDiao `tick_bn_only_flow()` or `tick_flow_master()` ZuoShouCiZhuangTai , HuiWuQuDong B/F/C etc. LiuCheng , and WenDang "detection only, does not drive flow" MaoDun . 
2. ** ChuShiJianCeFang to FeiZhuXianCheng **: WenDangMingQue "Initial check on main thread" to BianShouZhenQianWanCheng refresh and notify; if Ba `do_window_monitor_initial_check()` GaiChengYi step or Fang to timer XianChengCaiPao , ShouZhenKeNengNa not to ZhuangTai , DiBuLanHuiShan or XianShiKong . 
3. ** use check_window() ZuoShouCiJianCe **: `check_window()` in window_monitor_timer Li use at "flow inactive when 10s ShuaXin "; ChuShiJianCeYingZhiJie use `run_full_status_refresh()`, if ShouCiPaoCheng `check_window()` KeNengShou is_flow_active or Qi it item JianYingXiang , DaoZhi not executed or LuoJiFenZhiCuo . 
4. ** Diao use ShunXu **: BiXuXian `start_timer_loop_after_ui_ready()` ( within HanTong step do_window_monitor_initial_check) , Zai `ui.run()`; if Xian run Zai initial check, ShouZhenYiXianShiCaiShuaXin , Hui have MingXianYanChi or KongBai . 
5. ** WenDang and DaiMa not Tong step **: if thread_registry, one_shot_tasks, rosbot_task_processor in FuHao or LiuChengGai ( such as ZhongMingMing do_window_monitor_initial_check, or initial check Gai to BieChu ) , WenDangWeiGengXinHuiWuDaoHouXuXiuGai . 

### 1.3 ZhengQueZuoFa 

- QiDong when JinTongGuo `start_timer_loop_after_ui_ready()` within ** ZhuXianChengTong step ** `do_window_monitor_initial_check()` ZuoChuShiJianCe ; GaiHanShu within ZhiDiao `run_full_status_refresh()` + `notify_window_callbacks()`, not Diao flow tick. 
- not in CiLuJing use `check_window()` or RenHe tick_bn_only_flow / tick_flow_master as " ChuShiJianCe ". 
- XiuGai thread_registry, one_shot_tasks, window_monitor ChuShiJianCeLuoJi when , Tong step GengXin this WenDang Flow and Code locations Biao . 

---

## Er , athtest/square_sampler.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: FangGeCaiYangJianCeSuanFa -- use 2222 FangGe , SiJiaoCaiYangDian , in TuXiangShangJianCe and " AnNiuYanSe " PiPei QuYu ; Cong in XinKuoZhanLianTongQu , ManZuZuiXiaoXiangSuShuZeJi for Yi JianCeQuYu . 
- ** ShuRu **: ZhuTu (PIL Image) + AnNiuYanSeShuJu (JSON: `regions.hex_pixels`, every item Han `color` etc. ) ; YanSeJing hex_to_rgb, is_color_in_button_colors ( LiangDu 5%, HSV RongCha ) PiPei . 
- ** CanShu **: square_size=22, step_size=20, tolerance=0.05, expand when max_expansion=100, ZuiXiaoQuYuXiangSuShu 20, bbox padding 5. 
- **main()**: hardcode San LuJing -- ZhuTu , button_data_file, JieGuoTu ; LuJing in for `apps\d3-check`, `.cache\file_processor\button_pixels_sample.json` etc. , and DangQian project if for `pyapps/d3-check` or not TongHuanCun directory Hui not YiZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** LuJing hardcode **: main() within LuJingZhiXiang `apps\d3-check` and `.cache\file_processor\...`; if project Gen or sub project for `pyapps/d3-check`, HuanCun directory Ming not Tong , ZhiJieYun line Hui FileNotFoundError; YingGai for Cong config / MingLing line / project GenTuiDaoLuJing . 
2. **JSON structure YiLai **: `load_button_colors` JiaDing `data['regions']['hex_pixels']` Cun in Qie every item have `color`; if ShangYouDaoChuGeShiGai for Qi it key ( such as `pixels`, `samples`) or QianTao structure BianHua , Hui KeyError or QuCuoShuJu . 
3. ** and ZhuLiuChengHun use **: this Jiao this in athtest Xia , Shu test / GongJu ; if ZhuLiuCheng ( such as D3/D4 JieMianJianCe ) WuYin use this module QieWeiBaoZhengShuRuGeShi and LuJingYiZhi , Hui line for YiChang ; YingMingQue " Jin athtest or ShouGongPaoJiao this use ". 
4. ** CanShuWeiWenDangHua **: tolerance, square_size, step_size, min pixels, padding etc. if in DaiMa in GaiMoRenZhiWeiTong step WenDang or ZhuShi , it RenFu use when Hui use CuoJiaShe . 
5. **PIL getpixel**: to DuoTongDaoTuFanHuiYuanZu , to P MoShiKeNengFanHuiZhengShu ; is_color_in_button_colors etc. if JiaDingShiZhong for (r,g,b) SanYuanZu , in Qi it MoShiKeNengBaoCuo . 

### 2.3 ZhengQueZuoFa 

- main() in LuJingGai for MingLing line CanShu or Ji at `Path(__file__)`/ project GenTuiDao , BiMian hardcode apps or .cache sub LuJing . 
- to JSON ShuRuZuoCun in XingJianCha ( such as `data.get('regions', {}).get('hex_pixels', [])`) , and to QueShi / KongLieBiao to ChuMingQueTiShi . 
- in module Tou or README in ZhuMing purpose ( FangGeCaiYangJianCe , athtest) , ShuRuGeShi and CanShuHanYi , and ZhuLiuCheng D3/D4 JianCeQuFenKai . 

---

## San , controller/d4func/events/game_state_events.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: D4 YouXiZhuangTaiXiangGuanShiJian HuiDiao ; ** not JieShouCanShu **, Suo have ShuJuCong `get_d4_interface_data()` shared data DuQu . 
- ** ShiJian **: 
- `on_game_state_changed()`: GenJu `d4_data.is_exp_farming_running()` XianShi Running/Stopped. 
- `on_current_map_changed()`: Cong `d4_data.detected_regions['map_name']` DuDangQian Tu , no ZeXianShi Unknown. 
- `on_dungeon_progress_changed()`: Cong `d4_data.detected_regions['dungeon_progress']` DuFu this JinDu , no Ze Unknown. 
- ** ShuJuYuan **: WenDangZhuMing "D4State functionality now integrated into D4InterfaceData"; i.e. YingTongYi use `get_d4_interface_data()`, not YaoZai use YiFeiQi D4State DanDuJieKou . 
- ** LuJing **: `current_dir = Path(__file__).parent.parent.parent.parent` ( Cong `controller/d4func/events/` ShangSiJi to project Gen ) , use at sys.path.insert; if WenJianYiDong or Bao structure BianHuaHuiCuo . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **detected_regions JianMing **: on_current_map_changed ZhiDu `map_name`; map_name_utils Tong when WeiHu `map_name` and `current_map`. if MouChuZhiXie `current_map` and this LiZhiDu `map_name`, HuiYiZhi Unknown; Xu and map_name_utils set/get YueDingYiZhi . 
2. **detected_regions for None**: if detected_regions for None, `d4_data.detected_regions and 'map_name' in ...` HuiDuanLu for False, not HuiBaoCuo but XianShi Unknown; if Qi it DaiMaJiaDing detected_regions ShiZhong for dict KeNeng elsewhere BaoCuo ; ShiJian within YiZuoPanDuan , but XieRuFangXuBaoZhengYaoMe None YaoMe dict. 
3. ** LuJingJiaDing **: Si parent JiaDingWenJian in `controller/d4func/events/`; if YiDong to d4func XiaBieCeng or events GaiMing , XuGai parent CiShu or Gai use share.project_path etc. TongYiRuKou . 
4. **D4State and D4InterfaceData**: ZhuShiShuo D4State Yi and Ru D4InterfaceData; if XinDaiMaRengCong D4State DuZhuangTai and ShiJianCong D4InterfaceData Du , HuiLiangTaoShuJu not YiZhi . 
5. ** ShiJianZhuCe and Diao use when Ji **: if ShiJian in shared data ShangWeiGengXin when by ChuFa ( such as XieRuQian then fire) , HuiDu to JiuZhi ; Shui in He when fire this XieShiJianXu and XieRu detected_regions / is_exp_farming_running when JiYueDingQingChu . 

### 3.3 ZhengQueZuoFa 

- DuXie map_name when and map_name_utils YiZhi : Tong when WeiHu `map_name` and `current_map`, DuQu when YouXian map_name Zai current_map. 
- ShiJian within BaoChi to detected_regions None and key Cun in XingJianCha ; XieRuFangBaoZheng detected_regions for None or HeFa dict. 
- project LuJing by TongYiRuKou ( such as share.project_path) TiGong , BiMian in Duo WenJianLiChongFu parent.parent Lian . 
- ShiJianChuFa when Ji and region_detector, map_name_recognizer, exp_farming etc. XieRu shared data when JiWenDangHua , BiMianXian fire HouXie . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as ChuShiJianCe use flow tick or FeiZhuXianCheng , INITIAL_STATE_DETECTION WenDangWeiTong step , square_sampler LuJing or JSON structure hardcode / GaiHuai , game_state_events detected_regions JianMing or LuJingJiaDingCuoWu ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for ShiXian and YueDing not YiZhiSuoZhi . this note YiXieRu `cursor_AI_ apology directory `, and in `Cursor_ ZhuanShu apology document .md` in ZengJia to this Wen Yin use , Bian at HouXuXiuGaiQianXianChaCiChuYueDing . 
