# technical note : flow_bn_only_state, ui/utils, map_name_recognizer

** Mu **: note this SanChuDaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `d3utils/rosbot_flow/flow_bn_only_state.py`
- `ui/utils/__init__.py`
- `controller/d4func/map_name_recognizer.py`

---

## Yi , d3utils/rosbot_flow/flow_bn_only_state.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** Jin ** BN-only LiuChengZiShenZhuangTai (tick within step + ShangYiCi BN tick JieGuo ) . DingYi `BnOnlyTickStep` (REFRESH_NOTIFY RE_READ_ABORT RUN_BN_TICK HANDLE_BN_RESULT) , `BnOnlyBlockResult` (CONFIRMED / EXIT / WAIT / UNKNOWN) , module JiBianLiang `_last_bn_done`, `_last_bn_result`; TiGong `get_last_bn_result()`, `set_last_bn_result(done, result)`, `reset_bn_only_flow_state()`. 
- ** and flow_bn_block_state GuanXi **: WenDangMingQue "BN block state (B1..B16) lives in **flow_bn_block_state**; **Flow-master never imports this module**". i.e. B1~B16 JieDian , DangQianJieDian , etc. Dai when Jian etc. Jun in flow_bn_block_state; this module ZhiCun "BN-only YiCi tick step " and " ShangCi tick_battlenet_ready_flow done/result". Flow-master ( ZhuLiuCheng ) ** not ** import this module ; Zhi have BN-only tick QuDongLuoJi use . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **Flow-master Yin use this module **: if in flow_master_driver or ZhuLiuCheng in import flow_bn_only_state and Du / Xie _last_bn_result, HuiPoHuai "Flow-master not YiLai BN-only within BuZhuangTai " YueDing , QieKeNengBa BN block ZhuangTai and BN-only ZhuangTaiHun in YiQi . 
2. ** Ba B1..B16 ZhuangTaiFangJin this module **: if JiangDangQian BN JieDian , _current_node, _wait_until etc. YiRu flow_bn_only_state, and flow_bn_block_state ZhiZeChongFu , QieWenDangYiYueDing block ZhuangTai in flow_bn_block_state. 
3. ** Gai BnOnlyTickStep ShunXu **: if DiaoHuan REFRESH_NOTIFY / RE_READ_ABORT / RUN_BN_TICK / HANDLE_BN_RESULT ShunXu or TiaoGuoMou step , BN-only tick QuDongLuoJiHuiCuo . 
4. ** Gai BnOnlyBlockResult MeiJuZhi **: if XiuGai CONFIRMED/EXIT/WAIT/UNKNOWN char FuChuanZhi or HanYi , Diao use set_last_bn_result / get_last_bn_result BN-only LuoJiHuiWuPan . 
5. **reset ZhiQing this module **: reset_bn_only_flow_state() ZhiQing _last_bn_done/_last_bn_result; if QiWang " ZhongZhi BN block " YingDiao use reset_flow_master_bn_block or flow_bn_block_state reset, not YaoWu to for this HanShuHuiQing B1..B16. 

### 1.3 ZhengQueZuoFa 

- Flow-master and ZhuLiuCheng not import flow_bn_only_state; Jin BN-only tick DaiMa ( such as rosbot_task_processor in Jin BN segment ) use get/set_last_bn_result, reset_bn_only_flow_state and BnOnlyTickStep. 
- B1..B16 XiangGuanZhuangTaiZhiFang in flow_bn_block_state; this module JinBaoLiu " ShangCi BN tick JieGuo " and " DangQian BN-only tick step ". 

---

## Er , ui/utils/__init__.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ui.utils Bao to WaiRuKou , JinDaoChu `tk_variables` var_bool, var_str, var_int, var_double and `app_root` get_app_root; __all__ MingQueLieChuShangShuFuHao . Qi it module TongGuo `from ui.utils import var_bool, get_app_root` etc. use . 
- ** YiLai **: YiLaiTongBaoXia tk_variables, app_root; if this Liang module GaiMing , YiDong or ShanChu , __init__.py HuiDaoRuShiBai . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in __init__.py in newly added DaoChuWeiTong step **: if in tk_variables or app_root in newly added FuHao but Wei in __init__.py __all__ and import in JiaRu , Diao use Fang from ui.utils import xxx HuiBaoCuo ; if in __init__.py in Xie import but __all__ WeiBaoHan , BuFenGongJu or WenDangKeNengRen for GaiFuHaoFeiGongKai . 
2. ** in __init__.py in ShanChuDaoChu **: if YiChu var_bool/var_str etc. of Yi , Suo have from ui.utils import var_bool DaiMaHuiShiBai . 
3. ** in __init__.py in XieYeWuLuoJi **: this WenJianYingZhiZuo re-export, not YingFang run_/do_ or FuZaLuoJi , FouZeWeiFan PROJECT_STANDARDS in " DaoRuFang in DingBu , not in YeWu in SanLuo " and Bao structure YueDing . 
4. ** XunHuanYin use **: if ui.utils Xia module FanGuoLai import ZhuChuang or ShangCeng ui Bao , KeNengXingChengXunHuan ; newly added DaoRu when XuBiMian . 

### 2.3 ZhengQueZuoFa 

- newly added / ShanChu ui.utils to Wai API when , Tong step XiuGai __init__.py import and __all__; BaoChi this WenJianJin for BaoFengZhuang , no YeWuLuoJi . 

---

## San , controller/d4func/map_name_recognizer.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: D4 TuMing OCR ShiBie . Jin in **is_post_switch_idle for True** when Zhi line ShiBie ; Cong `get_d4_interface_data().detected_regions['region_images']['Map Name']` Qu TuMingQuYuTuXiang (PIL) ; use CnOCR Zuo OCR; JieGuoTongGuo **map_name_utils.set_current_map_name(map_name)** XieHuiGongXiangShuJu ; ChengGong or Da to max_recognition_attempts HouZhongZhi is_post_switch_idle and recognition_attempts. YiLai ocr_config.get_ocr_config_for_task('map_name'), CnOCREngine; LuJingJiaShe : current_dir = Path(__file__).parent.parent.parent ( i.e. pyapps/d3-check Gen ) , pycore in current_dir.parent / "pycore". 
- ** ShuJuYueDing **: detected_regions XuHan `region_images`, Qie `region_images` XuHanJian **'Map Name'** ( and D4 QuYuDingYiYiZhi ) ; set_current_map_name and map_name_utils map_name/current_map YueDingYiZhi . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **detected_regions structure not YiZhi **: if region CaiJiFangXieRu key for `map_name` or `map name` and Fei `'Map Name'`, or no have region_images, recognize_map_name HuiZhiJie return False, not HuiBaoCuo but YongYuan not ShiBie . 
2. ** in is_post_switch_idle for False when Diao use **: HanShuKaiTou then JianCha is_post_switch_idle, for False Ze return False; if Diao use Fang in WeiShe is_post_switch_idle or TuShangWeiQieHuanWanCheng when Diao use , not HuiZhi line OCR. 
3. **set_current_map_name and map_name_utils not Tong step **: if map_name_utils Gai for Xie not Tong char segment or not TongShuJu structure , and this module RengZhiDiao set_current_map_name, XuQueBao map_name_utils within BuYiTongYi ; if in this module within ZhiJieXie d4_data.detected_regions and not Jing set_current_map_name, HuiRaoGuo map_name_utils YueDing ( such as map_name/current_map, ShiJianTongZhi etc. ) . 
4. ** LuJingJiaShe **: current_dir = parent.parent.parent JiaDing __file__ in controller/d4func/ Xia ; if WenJianYiDong , sys.path and pycore LuJingHuiCuo . CnOCR TongGuoLin when WenJianDiao use ocr(temp_path), if Lin when directory no XieQuanXianHuiShiBai . 
5. **max_recognition_attempts HouZhongZhi **: Da to ZuiDaChangShiCiShuHouHuiQing is_post_switch_idle and recognition_attempts; if Diao use FangYiLai " YiZhiBaoChi idle Zhi to ShiBieChengGong ", Hui and DangQian " ZuiDuoShi N Ci then FangQi " line for not Fu . 
6. **I18nManager ShiLi **: GouZao self.i18n but DangQianDaiMa not used ; if HouXu use i18n ZuoRiZhi or UI WenAn , Xu and i18n_skill_config etc. key YiZhi ; ShanChu self.i18n if it Chu no Yin use Ze no YingXiang . 

### 3.3 ZhengQueZuoFa 

- BaoZheng detected_regions.region_images key and D4 BiaoZhunQuYuMingYiZhi ('Map Name') ; Diao use Fang in " TuQieHuanWanCheng , YiShe is_post_switch_idle" HouZaiDiao recognize_map_name. 
- TuMingXieRuTongYiTongGuo map_name_utils.set_current_map_name, not ZhiJieGai d4_data.detected_regions map XiangGuan char segment ; and map_name_utils, game_state_events etc. YueDingYiZhi . 
- LuJing and pycore YiLaiBaoChi and project Gen , controller/d4func position ZhiYiZhi ; if project structure TiaoZhengXuTong step Gai current_dir and pycore LuJing . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as Flow-master Yin use flow_bn_only_state, Ba B1..B16 ZhuangTaiFangJin bn_only_state, Gai ui.utils DaoChuWeiTong step , map_name_recognizer region key or set_current_map_name use CuoWu ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
