# technical note : bag_layout_detector, _obsolete_game_state, hotkey_registry, dump_rosbot_actual_result, flow_f1c_f1d

** Mu **: note CiWuChuWenJian ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `d3utils/collectors/collect_tools/bag_layout_detector.py`
- `utils/_obsolete_game_state.py`
- `d3utils/d3u_common/hotkey_registry.py`
- `scripts/dump_rosbot_actual_result.py`
- `d3utils/rosbot_flow/flow_f1c_f1d.py`

---

## Yi , d3utils/collectors/collect_tools/bag_layout_detector.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: D3 BeiBaoBuJuJianCe . AnLieSaoMiao , use FenGeXianPanDuanXiangLinGe is FouTongYiWuPin (2 GeWuPin ) , ZaiPanKongGe ( YanSeJunYun ) , Zai to WuPinZuoYanSeFenXi and YingShePinZhi (greenlegendary_set, dark_goldlegendary, yellowrare, bluemagic) . YiLai **share.game_interface_data** get_interference_colors, get_color_references, **SEPARATOR_COLOR_TOLERANCE**, **SEPARATOR_SCAN_HEIGHT_PERCENT**, **SEPARATOR_SCAN_WIDTH_PERCENT**, get_global_scale; **CONFIG** system_settings.bag_offset ( KeShiHua use ) ; **d3u_common.image_annotator_helper** create_annotator, draw_grid_overlay, get_annotation_color. detect_layout(bag_image, bag_coords) FanHui **'layout'** (2D ShuZu ) , **'items'** ((row,col)type/quality/color_analysis) , **'color_analysis'**. KeShiHua output to **~/.core_node/pytools/tmp/bag_layout_*.png**. 
- ** YueDing **: FenGeXian and YanSeXiangGuanChangLiang to share.game_interface_data for Zhun , Wu in detector within ZhongDingYi and share not YiZhi ChangLiang ; bag_offset and CONFIG Tong step ; layout slot Zhi for 'empty'|'item_1slot'|'item_2slot_top'|'item_2slot_bottom'|'item_or_empty' ( in JianZhuangTai ) ; Diao use FangYiLaiFanHui JianMing layout/items/color_analysis and items type/quality; XiuGaiJianMing or PinZhiYingSheXuTong step Diao use Fang . 

### 1.2 YiCuoDian 

- Gai SEPARATOR_* or YanSeChangLiangWeiTong step share.game_interface_data HuiJianCeCuo ; Gai bag_offset WeiTong step CONFIG HuiKeShiHuaPianYiCuo ; Gai detect_layout FanHui structure HuiPoHuaiDiao use Fang . 

### 1.3 ZhengQueZuoFa 

- XiuGaiJianCeLuoJi or ChangLiangQianXianKan share.game_interface_data and CONFIG; BaoChiFanHui char Dian structure WenDing ; output LuJing for Home/.core_node/pytools/tmp. 

---

## Er , utils/_obsolete_game_state.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi module ** (_obsolete_ QianZhui ) . GameState Lei : mapstatus (normal/rift/gem_upgrade/paused/inactive/loop) , pause/resume, loop Chao when , inactive Chao when , gem_upgrade JiShu ; QuanJu **GAME_STATE**. WenJian in use **CONFIG** (loop_timeout_seconds, gem_upgrade_action_count etc. ) , but ** this WenJian within Wei import CONFIG**, if by DanDuJiaZaiHui NameError; DangQian project Ying to Qi it ZhuangTaiGuanLi for Zhun , not Yin use this WenJian . 
- ** YueDing **: not Yin use , not in CiKuoZhan ; ShanChuQian confirm no import GAME_STATE or GameState Yin use . 

### 2.2 YiCuoDian 

- WuDangKe use ZhuangTaiGuanLi use HuiYinRuJiuSheJi ; if XiuFu CONFIG Wei import and in this WenJian within Bu import Reng not GaiBianFeiQiDing position ; and Xian have flow/ ZhuangTaiSheJiKeNengChongTu . 

### 2.3 ZhengQueZuoFa 

- ShiZuoZhiDuLiShiCanKao ; ZhuangTai and Chao when LuoJi to DangQian flow and game_interface_data etc. for Zhun ; ShanChuQian grep GAME_STATE, GameState, _obsolete_game_state. 

---

## San , d3utils/d3u_common/hotkey_registry.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: TongYiReJianZhuCe . ** _assistant_callback** by **controller Ceng ** TongGuo **set_assistant_callback(cb)** ZhuRu ; register_assistant_hotkey Cong **CONFIG macro_configs.auxiliary_config.assistant_hotkey** DuQuReJian , callback within Diao use get_assistant_state, set_assistant_should_stop, can_start_assistant, if KeQiDongZeDiao use **_assistant_callback()**. **d3utils not import controller**, BiMianXunHuanYiLai ; ReJianShiJiZhi line LuoJi by controller ZhuRu . get_hotkey_registry() DanLi ; initialize_hotkeys() by ShangCeng in HeShi when JiDiao use . 
- ** YueDing **: not Ke in d3utils within import controller LaiTian callback; controller BiXu in QiDongLiuCheng in set_assistant_callback; if Wei set ZeAnReJian when _assistant_callback for None HuiDaYin "Callback not set (controller not ready)". 

### 3.2 YiCuoDian 

- in hotkey_registry or d3utils within ZhiJie import controller HuiXunHuanYiLai ; in callback within hardcode controller LuoJiHuiPoHuaiFenCeng ; XiuGai CONFIG JianLuJingWeiTong step HuiDu not to ReJian . 

### 3.3 ZhengQueZuoFa 

- JinTongGuo set_assistant_callback ZhuRu ; ReJian config Jian for macro_configs.auxiliary_config.assistant_hotkey; register_hotkey LaiZi global_hotkey_manager. 

---

## Si , scripts/dump_rosbot_actual_result.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: ** DuLiJiao this **, Jiang rosbot_manager DangQianJianCeJieGuoWanZheng dump to WenJian . **project_root** = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) ( i.e. scripts FuJi , if Jiao this in scripts XiaZe for pyapps/d3-check or repo MouCeng ) ; output LuJing for **project_root/scripts/test_rosbot_actual_result.txt** ( ZhuYi : if project_root for pyapps/d3-check Ze output for pyapps/d3-check/scripts/...) . YiLai get_rosbot_manager(), CONFIG ros_settings.ros_directory ( Jiao this within ChangShi initialize_config) . docstring ZhuMing "Run from pyapps/d3-check". 
- ** YueDing **: Yun line QianQueBao sys.path and project_root conform to YuQi ; output WenJianLuJingYiLai __file__ and project_root; if Jiao this YiDong or to not TongRuKouYun line , project_root HuiBianDaoZhi output LuJingCuo . 

### 4.2 YiCuoDian 

- CongCuoWuGongZuo directory or module Yun line Hui project_root Cuo , XieCuoLuJing ; XiuGai output LuJingWeiTong step WenDang or Diao use FangHuiZhao not to output WenJian . 

### 4.3 ZhengQueZuoFa 

- An docstring Cong pyapps/d3-check or scripts XiaYun line ; not in CiJiao this within ZengJia by ZhuYing use import API; output LuJing for project_root/scripts/test_rosbot_actual_result.txt. 

---

## Wu , d3utils/rosbot_flow/flow_f1c_f1d.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: F1c/F1d (ROSBOT_FLOW_MERMAID.md) . **F1d**: JianCeDiaoXianHou set_d3_dynamic_status(disconnected=True), **reset_bn_block_state(False)**, **Caller ZaiDiao run_f1c_end_d3** ( this module within not Diao ) . **F1c**: kill D3 JinCheng , ** XiaYi tick JinRu F_Entry** ( this module within not Diao F_Entry) . run_f1d_on_disconnect and run_f1c_end_d3 FenKai ; ShunXu by caller BaoZheng : Xian F1d Zai F1c. 
- ** YueDing **: and ZhuanShu apology document No. SanShiSiJie , technical note _ SheJiWenDang and BATTLENET_REGION_DESIGN_REVIEW and battlenet_button_detector and flow_f1c_f1d YiZhi ; run_f1d within not Diao run_f1c; F1c within not Diao F_Entry; reset_bn_block_state LaiZi flow_bn_block_state. 

### 5.2 YiCuoDian 

- in run_f1d within Diao run_f1c HuiPoHuai caller YueDing ; in run_f1c within Diao F_Entry HuiPoHuai " XiaYi tick" YuYi ; Gai state or reset LuoJiXu and flow SheJiYiZhi . 

### 5.3 ZhengQueZuoFa 

- XiuGaiQianTongDu ROSBOT_FLOW_MERMAID.md and SheJiWenDang ; caller Xian F1d Zai F1c; F1c Jin kill D3. 

---

## Liu , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuWuChuYueDing and in CiWuChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia No. SanShiQiJieYin use . 
