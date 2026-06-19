# technical note : i18n_rosbot_panel_en, providor/constants, _obsolete_color_print, validate

** Mu **: note this SiChuDaiMa / config ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `providor/i18n/i18n_rosbot_panel_en.json`
- `providor/constants/__init__.py`
- `utils/_obsolete_color_print.py`
- `validate.py`

---

## Yi , providor/i18n/i18n_rosbot_panel_en.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: ROSBOT KuoZhan panel YingWenWenAn , Gong i18n_manager An key QuWen this . structure for **ui.rosbot** XiaDaLiangJian : title, configuration, path, browse, start, stop, status, log, scan, battlenet/d3/ros ZhuangTaiBiaoQian ( such as status_running, d3_disconnected, battlenet_on_login_screen) , ensure_battlenet_only, debug, oauth_script etc. . and i18n_main_window_en, i18n_skill_config_en etc. and Lie , An ** panel / GongNengYu ** FenWenJian . 
- ** use FangShi **: DaiMaCeTongGuo i18n_manager get_ui_text etc. JieKou , use and JSON within LuJingYiZhi key ( such as ui.rosbot.start_rosbot, ui.rosbot.d3_disconnected) ; key and JSON CengJi , MingMingBiXuYiZhi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **key LuJing not YiZhi **: if DaiMaLi use `rosbot.start_rosbot` or `ui.rosbot_extension.start`, and JSON Zhi have `ui.rosbot.start_rosbot`, HuiQu not to or QuCuo ; Fan of in JSON in GaiMing / YiDongJieDianWeiTong step DaiMa also HuiQueYi . 
2. ** newly added / ShanChu key WeiTong step **: in panel in newly added WenAn but Wei in i18n_rosbot_panel_en.json in Bu key, or ShanChu / ZhongMingMing key WeiGaiDaiMa , HuiDaoZhiXianShi key or KeyError. 
3. ** DuoYuYan not YiZhi **: if Cun in i18n_rosbot_panel_zh.json etc. , ZhiGaiYingWenWeiGai in Wen or structure not YiZhi , MouYuYanHuiQue key. 
4. ** Zhan position FuGeShi **: such as log_last_ago for "Last: {0} ago", DaiMaXuAn i18n_manager Zhan position FuYueDingChuanCan ( such as .format(t)) ; if Gai use {seconds} etc. MingMingZhan position Fu and i18n ShiXianZhiZhiChi position ZhiCanShu , HuiXianShiWeiTiHuan . 

### 1.3 ZhengQueZuoFa 

- ZengShanGai ROSBOT panel WenAn when , JSON and Suo have get_ui_text DaiMaYiQiGai ; key and i18n_manager MingMingKongJianYueDingYiZhi ( such as ui.rosbot.*) ; DuoYuYan JSON structure BaoChiYiZhi . 

---

## Er , providor/constants/__init__.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: constants MingMingKongJianRuKou , ** JinZuo sub module DaoRu and __all__ ShengMing **, not ZuoChangLiangJuHeZaiDaoChu . YueDing use Fa : `from providor.constants import common, d3, d4`, Zai `from providor.constants.common import TMP_DIR` etc. . WenDangZhuMing "Direct reference only; no aggregation re-export". 
- ** sub module **: common, d3, d4; __all__ = ["common", "d3", "d4"]. 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** newly added sub module Wei in __init__.py in ShengMing **: if in constants Xia newly added d5 or app_constants etc. , but Wei in __init__.py in `from . import d5` and JiaRu __all__, Ze `from providor.constants import d5` HuiShiBai . 
2. ** ShanChu or ZhongMingMing sub module WeiTong step **: if Jiang common GaiMing for base or ShanChu d4, WeiTong step __init__.py, HuiPoHuaiXian have `from providor.constants import common, d4` etc. DaoRu . 
3. ** in __init__.py in ZuoJuHeDaoChu **: if Xie `from .common import *` and re-export to this BaoDingCeng , and WenDang " not JuHe re-export" MaoDun , QieYiZaoChengMingMingChongTu or XunHuanYiLai . 
4. ** and app_constants HunXiao **: providor XiaLing have app_constants (D3/D4 YeWuChangLiang ) ; constants Bao for common/d3/d4 etc. ** directory **; not YaoWu in constants/__init__.py LiDaoChu app_constants FuHaoChuFeiMingQueYueDing . 

### 2.3 ZhengQueZuoFa 

- newly added / ShanChu / ZhongMingMing constants sub module when , Tong step XiuGai __init__.py import and __all__; BaoChi " JinYin use sub module , not JuHeChangLiang " use Fa . 

---

## San , utils/_obsolete_color_print.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: WenJianMingDai **_obsolete_**, BiaoShi ** YiFeiQi **. TiGongJiuBan ColorPrint: JingTai method green/blue/red/yellow/gray/white, update_line; use ANSI ZhuanYiMa ; module Ji _last_was_update_line use at update_line HouHuan line . ** no ** register_callback, no notify, no log_level. DangQian project TongYi use **pycore.pyfoundations.color_print** ColorPrint, ZhiChiHuiDiao ( such as log_panel ZhuCe ) , log_level, notify, GongZhuLiuCheng and UI RiZhiZhanShi . 
- ** and ZhuLiuChengGuanXi **: ZhuLiuCheng , log_panel, d3utils etc. YingZhiCong pycore ColorPrint DaoRu ; not CongCi _obsolete_ WenJianDaoRu . if MouChuWuCongCiWenJianDaoRu , Ze log not HuiJinRuZhuJieMianRiZhi , Qie line for and project QiYuBuFen not YiZhi . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Wu use obsolete Ban **: if in newly added DaiMa or XiuFu when Cong `utils.color_print` or `utils._obsolete_color_print` DaoRu ColorPrint, Ze no HuiDiao , log_panel Shou not to XiaoXi , or and Qi it module use pycore ColorPrint not TongYiShiLi . 
2. ** in obsolete WenJian in " Xiu bug"**: if in _obsolete_color_print in XiuGaiLuoJi and QiWangZhuChengXuShengXiao , ZhuChengXu and not use CiWenJian , XiuGai no Xiao . 
3. ** LiangTao ColorPrint Hun use **: BuFen module use pycore, BuFen use utils, HuiDaoZhiRiZhiZhi in YiChuXianShi , or update_line and callback line for not YiZhi . 
4. **columns YiLai **: obsolete Ban in module JiaZai when use shutil.get_terminal_size().columns, if in no TTY HuanJing ( such as GUI QiDong when ) KeNengYiChang or to MoRenZhi ; pycore BanKeNeng in not Tong when JiQu columns, line for KeNeng not Tong . 

### 3.3 ZhengQueZuoFa 

- Suo have XuYaoDaRiZhi or Can and UI RiZhi DaiMa , TongYi `from pycore.pyfoundations.color_print import ColorPrint`; not DaoRu utils._obsolete_color_print. FeiQiWenJianJinZuoCanKao , not in QiShangZuoGongNengXiuGai . 

---

## Si , validate.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: TongYiMoXingJiaoYanRuKouJiao this . LuJing : current_dir = os.path.dirname(os.path.abspath(__file__)) ( i.e. pyapps/d3-check Gen ) ; cache_dir = project_root / ".cache" / "training_data"; classification_dir = cache_dir / "3_models" / "classification"; detection_dir = cache_dir / "3_models" / "detection"; output_dir = ~/.core_node/pytools/tmp/validation. SaoMiaoFenLeiMoXing : Ge sub directory Xia weights/best.pt; FenLeiGuDing window_size=76, class_id=1 BiaoShi "yes". JianCeMoXing : data.yaml Cong 2_datasets/detection/unified_model/data.yaml Du class names; reasoning use 640x640 letterbox. use **pycore** ColorPrint. 
- ** YiLai **: ultralytics YOLO, cv2, numpy, yaml; FenLei / JianCe directory structure and train Jiao this ChanChuYiZhi (3_models/classification, 3_models/detection, 2_datasets/.../data.yaml) . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** LuJingJiaShe **: Jiao this JiaDing __file__ in pyapps/d3-check Gen ; if CongQi it directory use python -m or RuanLianFangShiYun line , current_dir KeNeng not d3-check Gen , cache_dir HuiCuo . 
2. ** directory structure BianGeng **: if train Jiao this Gai for 2_models or classification Fang in BieChu , validate 3_models/classification, 3_models/detection HuiZhao not to ; data.yaml GuDing for 2_datasets/detection/unified_model/data.yaml, if ShuJuJiGaiMing or ChaiFen , classes HuiCuo or QueShi . 
3. ** FenLei class_id and XunLianYiZhi **: DaiMaJiaDing class_id=1 for "yes"; if XunLian when data names ShunXu for [no, yes] Ze 1=yes, if for [yes, no] Ze 0=yes, ShunXuFan HuiWuPan . Xu and prepare_detection_training / train data.yaml names ShunXuYiZhi . 
4. ** JianCe classes and data.yaml**: detection_models classes LaiZiTongYiFen data.yaml; if Yi detection sub directory have DuLi data.yaml and DangQianLuoJiZhi use unified_model data.yaml, DuoShuJuJi when LeiBieKeNeng not to . 
5. **output_dir and QuanXian **: output to use Hu directory ~/.core_node/pytools/tmp/validation; if Gai directory no XieQuanXian or CiPanManHuiShiBai . 

### 4.3 ZhengQueZuoFa 

- Cong pyapps/d3-check Gen directory Yun line validate.py, or BaoZheng current_dir ZhiXiang d3-check Gen ; and train Jiao this directory MingMing (3_models, 2_datasets, unified_model) and data.yaml names ShunXuBaoChiYiZhi ; FenLei class_id and XunLian data yes/no ShunXu to Ying . 

---

## Wu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as i18n_rosbot_panel key and DaiMa not YiZhi , constants __init__ WeiTong step sub module , Wu use _obsolete_color_print DaoZhiRiZhi not XianShi , validate LuJing or class_id/data.yaml and XunLian not YiZhi ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
