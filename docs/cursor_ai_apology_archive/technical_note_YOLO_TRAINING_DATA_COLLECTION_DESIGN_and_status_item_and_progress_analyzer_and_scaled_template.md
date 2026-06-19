# technical note : YOLO_TRAINING_DATA_COLLECTION_DESIGN.md, status_item.py, progress_analyzer.py, scaled_template_matcher_backup_20260201.py

** Mu **: note you ZhiDingChaYue to XiaSiChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing .

** She and WenJian **:
- `docs/YOLO_TRAINING_DATA_COLLECTION_DESIGN.md`
- `ui/components/status_item.py`
- `athtest/progress_analyzer.py`
- `docs/backup/scaled_template_matcher_backup_20260201.py`

---

## Yi , docs/YOLO_TRAINING_DATA_COLLECTION_DESIGN.md

### 1.1 ZhiZe and YueDing

- ** purpose **: YOLO XunLianShuJuCaiJi WanZhengSheJiFangAn . RuKou in ZuoBiaoXiaoZhun panel "YOLO XunLianShuJuCaiJi " AnNiu ; AnDangQianKeHuDuanJieTuHouDaKai YOLO BiaoZhuChuangKou ; ShuJuMoXing class_names, screenshot_history ( every item image + annotations) , current_index; BiaoZhuLeiXing rect/circle/polygon/freehand, DaoChuZhuan bbox; ShengChengShuJuJi to YOLO_DATASET_BASE_DIR / yolo_dataset_YYYYMMDD_HHMMSS or HuiHua directory session_dir; 8 YiShiXianXiJie : Lin when directory , yolo_collect_config.json, ShiBieLeiXing and get_yolo_collect_class_color(index), BiaoZhuLieBiao " Tu " LieDieJia , ShuaXinJieTu append not QingKong , generate_dataset_from_screenshot_history(..., output_dir=session_dir).
- ** YueDing **: ShiXianXu and WenDangYiZhi : output LuJing , data.yaml (path/train/val/nc/names) , BiaoQianGeShi , no MuBiao not Xie .txt; LeiBieYanSe by app_constants.get_yolo_collect_class_color(index); CONFIG Jian yolo_collect.session_dir, yolo_collect.classes. XiangJian this directory ** technical note _YOLO_TRAINING_DESIGN and bottom_bar_status_block and screenshot_handler and obsolete_analyzer and d3_macro_controller.md** No. YiJie .

### 1.2 Yi by WuJie or GaiCuo Yuan because

1. ** output directory and WenDang not Fu **: if ShiXianXie to Qi it LuJing or ShengChengShuJuJi when XinJian when JianChuo directory and FeiDangQian session_dir, and 8.1/8.6 not Fu .
2. **data.yaml or BiaoQianGeShi and Ultralytics not YiZhi **: path use FanXieGang , names Fei char Dian , BiaoQianWeiGuiYiHua 0~1 Liu position XiaoShu , no MuBiaoTu also Xie .txt, HuiDaoZhiXunLianBaoCuo .
3. ** ShuaXinJieTu line for **: WenDang 8.4 MingQueXinJieTu append to history; if ShiXianChengQingKong or FuGaiDangQian item , and SheJi not Fu .
4. **8 and ShiXianTuoJie **: if ZhiDuQianJiJieWeiDu 8 KaiFaXiJie ( YiShiXian ) , HuiLouDiao session_dir, yolo_collect_config.json, get_yolo_collect_class_color, DieJiaBiaoZhuLieBiao etc. YueDing , GaiCuo or ChongFuZaoLun sub .

### 1.3 ZhengQueZuoFa

- XiuGai or ShiXian YOLO CaiJiXiangGuanGongNengQianTongDuQuanWenYouQi 4, 8; output directory , data.yaml, BiaoQianGeShi , screenshot_history and session_dir line for and WenDangYiZhi .

---

## Er , ui/components/status_item.py

### 2.1 ZhiZe and YueDing

- ** purpose **: DiLan ** Dan item ZhuangTai item ** ZuJian . `make_status_item(parent, label_text, var, fg=None)` FanHui `(frame, value_label)`; frame within for "label_text:"+ BangDing `textvariable=var` value_label; value_label GongDiao use FangHouXuAnZhuangTaiGengXin fg ( QianJingSe ) . Diao use Fang for bottom_bar_status_block: use status_row_config (label_i18n_key, var_key, default_fg) BianLi , to every item Qu status_vars[var_key] StringVar, get_ui_text(label_i18n_key) Zuo label_text, default_fg Zuo fg, Diao use make_status_item, pack frame, and Jiang value_label TongGuo register_callback HuiChuan to bottom_bar, Gong _update_ui_from_state when She value_label["fg"].
- ** YueDing **: FanHuiZhiBiXu for (frame, value_label), Qie value_label textvariable=var; Diao use FangYiLai value_label Zuo fg GengXin , Gu not KeGai for ZhiFanHui frame or GaiBian value_label LeiXing ; YangShi use UnifiedStyles.COLORS, UnifiedStyles.FONTS, and project TongYiFengGeYiZhi .

### 2.2 Yi by WuJie or GaiCuo Yuan because

1. ** GaiQianMing or FanHuiZhi **: if Jiang make_status_item Gai for ZhiFanHui frame or ZengJia / JianShaoCanShuWeiTong step bottom_bar_status_block, HuiPoHuai register_callback(value_labels) YueDing , DaoZhi _value_labels Que item or fg no FaGengXin .
2. **label_text and i18n**: Diao use FangChuanRu label_text TongChang for get_ui_text(label_i18n_key); if status_item within BuZaiCiZuo i18n or PinJie , Hui and bottom_bar_status_block YueDingChongFu or ChongTu .
3. **fg MoRenZhi **: fg=None when use UnifiedStyles.COLORS['text_primary']; if Gai for Qi it MoRen or YiChu fg CanShu , Diao use FangChuanRu default_fg KeNeng no FaShengXiao , ZhuangTaiLanYanSeLuoJiCuo .
4. **UnifiedStyles YiLai **: if project QianYi to Qi it style XiTong or UnifiedStyles JianMingBianGeng , this WenJianXuTong step , FouZeDiLanGai item YangShiYiChang .

### 2.3 ZhengQueZuoFa

- XiuGai make_status_item QianMing or FanHuiZhiQianBiXuTong step bottom_bar_status_block and Suo have Diao use make_status_item DaiMa ; BaoChiFanHui (frame, value_label) Qie value_label Ke use at fg GengXin ; Wu in status_item within ChongFuZuo i18n, by Diao use FangChuanRuYiJieXi label_text.

---

## San , athtest/progress_analyzer.py

### 3.1 ZhiZe and YueDing

- ** purpose **: JinDu item FenXiJiao this . Cong JSON (regions.hex_pixels) JiaZaiQianJing / BeiJingSe ; QuTuXiang in JianYi line , AnQianJingSeZhaoLianXuXiangSu , JinDu = ZuiHouLianXuQianJing position Zhi / KuanDu . load_color_groups YueDing : cols = ceil(sqrt(num_colors)), No. Yi line Qian cols-2 for QianJingXiangGuan , ZuiHou 2 for BeiJing . analyze_progress_bar, create_visual_analysis YiLaiGai JSON structure and TuXiangLuJing .
- ** YueDing **: main() in LuJing hardcode apps\d3-check, .cache\file_processor; if project for pyapps/d3-check or HuanCunLuJing not TongHui FileNotFoundError. getbbox() QuKuanGaoYing use bbox[2]-bbox[0], bbox[3]-bbox[1], FouZeCaiJianTuHuiCuo . this Jiao this Shu athtest GongJu , ZhuLiuCheng D3/D4 JinDuJianCeYing use ZhengShi module , WuWeiWenDangHua then Fu use this Jiao this YueDing . XiangJian this directory ** technical note _d4_red_portal and progress_analyzer and BATTLENET_REGION and battlenet_button and flow_bn_only.md** No. ErJie .

### 3.2 Yi by WuJie or GaiCuo Yuan because

1. **getbbox() Wu use **: ZhiJie use img.getbbox()[2], getbbox()[3] Dang width/height, JinDang bbox Cong (0,0) ChengLi ; FouZeYing width=bbox[2]-bbox[0], height=bbox[3]-bbox[1], FouZeJinDuBaiFenBi and SaoMiaoFanWeiCuo .
2. ** LuJing hardcode **: main() in image_path, pixel_data_file, analysis_output GuDingLuJing , it Ji or pyapps/d3-check Yun line HuiBaoCuo .
3. ** in Jian line JiaShe **: middle_y = height//2; if JinDu item not in in Jian line , XuKe config or GaiSuanFa .
4. **JSON structure BianHua **: if hex_pixels or regions structure BianGengWeiTong step load_color_groups, HuiQuCuoQianJing / BeiJingSe .

### 3.3 ZhengQueZuoFa

- use getbbox() when width = bbox[2]-bbox[0], height = bbox[3]-bbox[1]; main() LuJingGai for CanShu or project GenTuiDao ; ZhuLiuChengFu use this SuanFa when in WenDang in XieMing JSON and line LieYueDing .

---

## Si , docs/backup/scaled_template_matcher_backup_20260201.py

### 4.1 ZhiZe and YueDing

- ** purpose **: ScaledTemplateMatcher ** LiShiBeiFen **, position at docs/backup, FeiZhuShiXian . ZhuShiXian in d3utils or providor scaled_template_matcher. this WenJian project_root = os.path.dirname(current_dir), i.e. **docs** directory ( because current_dir for docs/backup) , Gu sys.path.insert(0, project_root) Hou import is Xiang to at docs LuJing , and pyapps/d3-check for Gen GongCheng not YiZhi , ** not KeZhiJieYun line or DangZhuShiXianYin use **.
- ** YueDing **: JinZuoCanKao or to Bi ; XiuGaiMuBanPiPeiLuoJiYing to DangQian d3utils/providor in ScaledTemplateMatcher for Zhun ; if FuZhi this WenJianDaiMa to project in use XuGai project_root for project Gen and He to D3_TEMPLATE_CONFIGS, get_template_path, get_global_scale etc. import. XiangJian this directory ** technical note _rosbot_ui_elements and scaled_template_matcher_backup and _obsolete_ui_automation_controller and ROSBOT_UPDATE_FLOW.md** No. ErJie .

### 4.2 Yi by WuJie or GaiCuo Yuan because

1. ** WuDangZhuShiXian **: in LiuCheng or controller in import this BeiFenWenJian and Fei d3utils scaled_template_matcher, HuiDaoZhi project_root Cuo , HouXu import ShiBai or line for and ZhuShiXian not YiZhi .
2. **project_root for docs**: ZhiJieYun line this WenJian when current_dir for docs/backup, project_root for docs, sys.path Han docs not Han pyapps/d3-check, get_template_path, providor_index, share.game_interface_data etc. KeNengZhao not to or QuCuoLuJing .
3. ** and ZhuShiXianFenZhiChaYi **: BeiFenRiQi for 20260201, ZhuShiXianKeNengYiZengJia D4, BATTLENET_TEMPLATE_CONFIGS, match_template_auto_scale etc. , to BeiFen for ZhunXiuGaiHuiDiuShiXinLuoJi .

### 4.3 ZhengQueZuoFa

- not CongCiWenJian import or Yun line ; XuYaoGaiMuBanPiPei when Gai d3utils/providor in DangQian ScaledTemplateMatcher; CanKaoBeiFen when ZhuYi project_root and import LuJing and ZhuGongChengYiZhi .

---

## Wu , and apology document GuanXi

if CiQian because WeiXianTongDuShangShuSiChuYueDing (YOLO SheJi 8 and ShiXianYiZhi , status_item FanHuiZhi and bottom_bar value_labels YueDing , progress_analyzer getbbox/ LuJing /athtest Ding position , scaled_template_matcher_backup for BeiFenQie project_root for docs) and in CiSiChuFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md No. LiuShiSanJie in Yin use .
