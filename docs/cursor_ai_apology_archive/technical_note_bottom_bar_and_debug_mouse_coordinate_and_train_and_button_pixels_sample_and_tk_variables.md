# technical note : bottom_bar, debug_mouse_coordinate, train, button_pixels_sample, tk_variables

** Mu **: note CiWuChuZuJian / Jiao this / ShuJu / GongJu ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `ui/components/bottom_bar.py`
- `scripts/debug/debug_mouse_coordinate.py`
- `train.py`
- `athtest/button_pixels_sample.json`
- `ui/utils/tk_variables.py`

---

## Yi , ui/components/bottom_bar.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: DiBuLanZuJian : **Row0** = Hong + every Tab Xuan item (BottomBarOptionsBlock) , **Row1** = ZhuangTaiYi line (BottomBarStatusBlock) , **Row2** = Dan line Zhan position . **status_vars** ChuanRu BottomBarStatusBlock, XuHan **STATUS_ROW_1/STATUS_ROW_2** var_key: battlenet, ros, d3, map, stage, oauth, window_size; DangQianHaiHan ros_found ( if status_row_config no ros_found ZeGai item no to Ying label) . **_register_status_labels** BaoCun value_labels (var_key Label) , Gong **_do_window_status_ui_update** and **update_status_from_state** GengXinWenAn and fg. **update_status_from_state** fg_map Han battlenet, ros, d3, map, stage, oauth; window_size in on_window_status_update in DanDuShe fg. 
- ** YueDing **: status_vars key and status_row_config var_key YiZhiCai have to Ying label; fg_map key and _value_labels YiZhiCaiNengGengXinYanSe ; state key (battlenet_window_found, rosbot_extended_status, d3_running etc. ) and ZhuangTaiTiGongFangYueDingYiZhi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **status_vars and STATUS_ROW_1/2 not YiZhi **: if in status_row_config ZengShan item Wei in bottom_bar status_vars in Tong step ( or Fan of ) , HuiDuoChuKongLie , ShaoLie or _value_labels Que key, fg GengXin not to . 
2. **fg_map Lou key**: update_status_from_state in fg_map if LouDiaoMou var_key, GaiLie not HuiSuiZhuangTaiBianSe ; window_size not in fg_map in , in on_window_status_update DanDuChuLi . 
3. **state JianMing and TiGongFang not YiZhi **: if game_interface_data or notify_state_sync Xie JianMing and bottom_bar QiWang battlenet_disconnected, rosbot_extended_status etc. not Tong , XianShiCuo or not Bian . 
4. **ros_found and row config**: status_vars Han ros_found_status, if status_row_config no "ros_found" item , GaiBianLiang no to Ying Label; if XuXianShi ros_found Xu in status_row_config ZengJia to Ying item . 

### 1.3 ZhengQueZuoFa 

- XiuGai status_row_config when Tong step bottom_bar status_vars and update_status_from_state fg_map; BaoZheng state JianMing and ZhuangTaiTiGongFangYiZhi ; XuYaoXianShi LieJun in row config in have to Ying item . 

---

## Er , scripts/debug/debug_mouse_coordinate.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** TiaoShiJiao this **, XuanFuChuangShi when XianShiShuBiaoZuoBiao : PingMuZuoBiao , YouXiZuoBiao ( Xiang to D4 ChuangKou ) , BiaoZhunFenBianLvZuoBiao ( ChuangKouMoShiXiaAn D4_STANDARD_RESOLUTION_* and BianKuangChangLiangHuanSuan ) . YiLai **get_d4_interface_data()**: window_offset, game_window_size, is_windowed_mode(); ChuangKouMoShiXiaCong **game_interface_data** DaoRu WINDOW_BORDER_LEFT, WINDOW_BORDER_RIGHT, TITLE_BAR_HEIGHT, WINDOW_BORDER_BOTTOM JiSuan client QuYuZaiSuoFang . LuJing _project_root = __file__.parent.parent (d3-check) . GengXinXianCheng every 0.05s Du pyautogui.position() and d4_data, use root.after(0, lambda: ...) GengXin Label. 
- ** YueDing **: Yun line QianXu have D4 ChuangKouXinXi ( JieTu / CaiJiGuo ) , FouZe game ZuoBiao and BiaoZhunZuoBiao for N/A; BianKuangChangLiangXu and game_interface_data or D4 ChangLiang module YiZhi ; root.after(0, lambda) in if YiLaiXunHuanBianLiangXu use MoRenCanShuBuHuo , BiMianBiBaoBuHuoCuoWuZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. **d4_data Wei then Xu **: if Cong not executed D4 JieTu , window_offset/game_window_size for Kong , YouXiZuoBiao and BiaoZhunZuoBiaoXianShi N/A. 
2. ** BianKuangChangLiangLaiYuan **: Jiao this Cong game_interface_data DaoRu WINDOW_BORDER_LEFT etc. ; if this XieChangLiangGai to providor.constants.d4 or BieChuWeiTong step , HuanSuanCuo . 
3. **after(0, lambda) BiBao **: update_coordinates in SheZhi game_coord_text etc. Hou root.after(0, lambda: label.config(text=game_coord_text)); if lambda no CanShu , Zhi line when DuQu is DangQianBiBaoBianLiang , in 20 FPS XiaKeNengYi by XiaYiLunFuGai ; if XuGuDingDangCiZhiYing use MoRenCanShu lambda t=game_coord_text: .... 
4. ** LuJing **: Cong scripts/debug or d3-check GenYun line , BaoZheng _project_root ZhengQueFouZe import ShiBai . 

### 2.3 ZhengQueZuoFa 

- Xian have D4 CaiJiZaiYun line ; BianKuangChangLiang and project YueDingYiZhi ; after(0) HuiDiao if YiLaiXunHuan within BianLiang use MoRenCanShuBuHuo ; Cong d3-check Gen or scripts/debug Yun line . 

---

## San , train.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** TongYiXunLianRuKou **, JiaoHuCaiDan or CLI (--mode classification/detection/both, --epochs, --batch, --device) ; train_classification/train_detection/train_both Diao use **controller.training.D3CheckTrainingController**; interactive_mode() LieChu project , XianShiCaiDan , GenJuXuan item 1/2/3 Diao use train_*. LuJing current_dir = dirname(abspath(__file__)), i.e. pyapps/d3-check, sys.path.insert(0, current_dir). 
- ** YueDing **: YingCong pyapps/d3-check Yun line ; controller.training module XuCun in Qie D3CheckTrainingController ShiXian train_unified_classification, train_unified_detection etc. . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **interactive_mode in choice '3' DaiMaCuoWu **: in choice == '3' FenZhi within , result = train_both() of Hou have Shu line Yin use **project**, **best_model_dst**, **self.controller**, **metadata_file**, this Xie in interactive_mode() HanShuZuo use Yu within ** WeiDingYi ** ( LaiZiBieChuZhanTie ) , Zhi line to Hui **NameError**. YingShanChu or Gai for and train_both() FanHuiZhiYiZhi summary output . 
2. ** module Ji def run(self)**: WenJianYue 181 line Qi have **def run(self):** and Da segment SuoJinTi , Xing such as CongMouLei in ZhanTieChuLai run method ; in module DingCeng run(self) self no YiYi , Qie main() WeiDiao use run(), Gai segment for ** SiDaiMa **. if for WuZhanTieYingShanChu or YiHui to YingLei . 
3. ** Yun line directory **: if Cong repo Gen or BieChuYun line , current_dir not d3-check, import controller.training KeNengShiBai . 

### 3.3 ZhengQueZuoFa 

- XiuFu choice '3' FenZhi : QuDiao to project, best_model_dst, self, metadata_file Yin use , JinBaoLiu and train_both() JieGuoYiZhi TiShi ; JiangWuZhanTie run(self) and HouXuSiDaiMaShanChu or YiRuZhengQueLei ; Cong pyapps/d3-check Yun line . 

---

## Si , athtest/button_pixels_sample.json

### 4.1 ZhiZe and YueDing 

- ** purpose **: **athtest** CaiYangChanChuShiLi : **success**, **file_path**, **image_info**, **regions** (**region**, **region_info**, **hex_pixels** ShuZu , every item **color** (hex) , **x**, **y**) . **square_sampler**, **button_detector** etc. TongGuo **data['regions']['hex_pixels']** DuQuYanSe and ZuoBiao ; load_button_colors etc. QiWangGai structure . 
- ** YueDing **: XiaoFeiZhe (scripts/athtest) and ChanChuGeShiYiZhi ; file_path Chang for Jue to LuJing , Zuo fixture or KuaJi when XuZhuYiKeYiZhiXing ; if regions or hex_pixels JianMing / structure BianGeng , Suo have DuQuChuXuTong step . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. **file_path for Jue to LuJing **: ShiLi in file_path Han apps\d3-check; if project for pyapps/d3-check or it JiLuJing not Tong , ZuoCanKao when YiWuDao ; Zuo test fixture Ying use Xiang to LuJing or Zhan position . 
2. **regions.hex_pixels structure **: if Gai for regions.pixels or hex_pixels item Gai for {r,g,b} etc. , square_sampler, button_detector Hui KeyError or JieXiCuo . 
3. ** and ZhuLiuChengHun use **: this WenJianShu athtest CaiYang output ; ZhuLiuCheng D3/D4 JianCeWuZhiJieYiLaiCiWenJianLuJing or structure , ChuFeiWenDangHuaYueDing . 

### 4.3 ZhengQueZuoFa 

- XiaoFeiDaiMaTongYiCong data['regions']['hex_pixels'] DuQu ; XiuGai JSON structure when Tong step square_sampler, button_detector etc. ; fixture or WenDang use Xiang to LuJing or note KeYiZhiXing . 

---

## Wu , ui/utils/tk_variables.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: **Tk BianLiangGongChang **, BiMian "no default root window": **var_bool(master, value)**, **var_str(master, value)**, **var_int(master, value)**, **var_double(master, value)**, JunXuChuanRu **master** (Tk or Widget) . Suo have Xu Tk BianLiang UI YingTongGuo this module ChuangJianBianLiang , BaoZhengBianLiangBangDing to ZhengQueGenChuangKou . 
- ** YueDing **: not in module Ceng or no master when ZhiJie tk.StringVar() etc. ; XinJian UI ZuJian when BianLiangYiLv use tk_variables GongChangChuangJian . 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** ZhiJie tk.BooleanVar() etc. **: in no Tk Gen or CuoWu when JiChuangJianBianLiangHuiBao "no default root window" or BangDing to CuoWuGen , DaoZhiBianLiang not SuiChuangKouXiaoHui or no FaGengXin . 
2. **master ChuanCuo **: if ChuanRu master not MuBiaoChuangKouShu widget/toplevel, BianLiangKeNengShu at LingYiChuangKou , line for YiChang . 
3. ** newly added BianLiangLeiXingWeiTiGongGongChang **: if XuYaoQi it Tk BianLiangLeiXingQieWei in this module ZengJia to YingGongChang , Diao use FangKeNengZhiJie tk.XXXVar() DaoZhiShangShuWenTi . 

### 5.3 ZhengQueZuoFa 

- Suo have Tk BianLiangTongGuo tk_variables var_bool/var_str/var_int/var_double ChuangJian and ChuanRuZhengQue master; not ZhiJie use tk.XXXVar() no Can or Fei master GouZao . 

---

## Liu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as bottom_bar status_vars/fg_map and row config or state Jian not Tong step , debug_mouse_coordinate d4_data or after BiBao , train.py choice '3' WeiDingYiBianLiang and SiDaiMa run(self), button_pixels_sample structure or LuJing and XiaoFeiZhe not YiZhi , tk_variables Wei use DaoZhi no default root) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
