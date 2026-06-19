# technical note : bn_flow_B7.json, map_name_utils.py, prepare_detection_training.py

** Mu **: note this SanChuDaiMa / HuanCun ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `.cache/bn_flow_snapshots/bn_flow_B7.json`
- `controller/d4func/map_name_utils.py`
- `scripts/prepare_detection_training.py`

---

## Yi , .cache/bn_flow_snapshots/bn_flow_B7.json

### 1.1 ZhiZe and YueDing 

- ** XingZhi **: ZhanWangLiuCheng B7 JieDian ** Yun line when KuaiZhao **, by `save_ui_elements_snapshot` etc. XieRu ; FeiYuanMa , Shu .cache Xia KeZaiShengChanWu . 
- ** structure **: `meta.node` ( such as "B7") , `meta.reason` ( such as "B7_poll_elements") , `controls` ShuZu ; every item Han `name`, `automation_id`, `type`, `rect` etc. . B7 to Ying " LunXunDengLu / JieMianYuanSu " Jie segment . 
- ** use Fang **: battlenet_region_judge, is_login_failed_screen, is_on_login_screen etc. YiLai controls automation_id/name/ structure PanDuanDengLuZhuangTai ; if KuaiZhao structure and this XieLuoJi YuQi not YiZhi , HuiDaoZhiWuPan ( such as BaDengLu in PanChengWeiDengLu , or BaShiBaiYePanChengZhengChang ) . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Ba .cache DangQuanWeiShuJu **: if in DaiMa in hardcode `bn_flow_B7.json` LuJing or JiaDingGaiWenJianYiDingCun in , in QuanXinHuanJing or QingLiHuanCunHouHuiDaoZhiDuShiBai ; YingTongGuo config / ChangLiangQuKuaiZhao directory , and to QueShiWenJianZuoJianRong . 
2. ** XiuGai JSON structure WeiTong step DaiMa **: if in LuoJi in QiWang `controls[].automation_id` or `meta.reason` QuZhi / CengJi and Xian have KuaiZhao not YiZhi ( such as newly added char segment , GaiMing ) , and KuaiZhaoXieRuFangWeiGai , HuiDaoZhiJieXiShiBai or PanDuanCuoWu ; Fan of if ZhiGaiXieRuGeShiWeiGaiDuQu / PanDuanLuoJi also HuiCuo . 
3. **B7 KuaiZhaoQueShaoGuanJianKongJian **: B7 for LunXunYuanSuJie segment , if KuaiZhao in QueShaoDengLuXiangGuanKongJian ( such as " Zheng in DengLu ...", LoginWindow etc. ) , XiaYouHuiWuPan for WeiDengLu or FeiDengLuYe ; BaoCunKuaiZhao when Ji and ChuangKouZhuangTaiXu and B7 YuYiYiZhi . 
4. ** KuaJi / TiJiaoHuanCun **: .cache for this Yun line when ChanWu , if by TiJiao to Ban this Ku or in it JiDangQuanWeiYin use , KeNeng because FenBianLv , KeHuDuanBan this , YuYan not Tong and ShiXiao ; WenDang and Jiao this in YingZhuMing " KuaiZhao for Yun line when HuanCun , not KeYiZhiZeWuYiLai ". 

### 1.3 ZhengQueZuoFa 

- KuaiZhaoLuJingCongChangLiang or config DuQu , not hardcode `bn_flow_B7.json`; DuQuQianJianChaWenJianCun in , QueShi when JiangJi or TiaoGuo . 
- KuaiZhao meta/controls structure and battlenet_operation, battlenet_region_judge, is_on_login_screen etc. YueDingYiZhi ; newly added char segment or GaiMing when Tong when GaiXieRu and DuQu . 
- not in Ban this Ku in YiLai .cache within Rong as unique ShuJuYuan ; WenDang in note GeJieDianKuaiZhao purpose and KeYiZhiXingXianZhi . 

---

## Er , controller/d4func/map_name_utils.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: D4 TuMing and shared data DuXieFengZhuang ; `get_d4_interface_data().detected_regions` in use `map_name` or `current_map` CunDangQian TuMing . 
- ** JieKou **: `get_current_map_name_from_shared_data()` ( YouXian `map_name`, QiCi `current_map`, no Ze "Unknown") ; `set_current_map_name(map_name)` ( Tong when XieLiang Jian ) ; `clear_current_map_name()`; `is_map_name_available()`; `get_current_map_name()` for JianRongBieMing . 
- ** YiLai **: XieRuFangTongChang for map_name_recognizer or region_detector; if no RenXianXieRu , get HuiYiZhiFanHui "Unknown". 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** LuJingJiaDing **: `current_dir = Path(__file__).parent.parent.parent` JiaDingWenJian in `controller/d4func/` Xia ; if YiDongWenJianWeiGaiGai line , sys.path HuiCuo , DaoZhi import ShiBai . 
2. **detected_regions for None or QueShiJian **: get when if `detected_regions` for None or Ji no `map_name` also no `current_map` ZeFanHui "Unknown"; if region_detector / map_name_recognizer WeiXianXieRu , Diao use FangHuiWu to for " WeiShiBie " and ChongFuDiao use or LuoJiFenZhiCuoWu . 
3. ** ZhiJieXie detected_regions**: set/clear ZhiJieGai `d4_data.detected_regions`; if and region_detector `_extract_all_regions_to_share` or Qi it Xie detected_regions DaiMa and Fa , KeNengJingTai ; DuoXianCheng or Yi step ChangJingXuYueDingDanXie or JiaSuo . 
4. ** ZhiDuYi Jian **: DangQian get JianRong `map_name` and `current_map`; if MouChuZhiXieQi in Yi and LingYiChuZhiDuLingYi , Hui not YiZhi ; set YiTong when XieLiang Jian , BaoChiCiYueDing i.e. Ke . 
5. ** YiChang by Tun **: if in get/set/clear within use Luo except and FanHui "Unknown"/False and not DaRiZhi , HuiYanGai bug, Nan to PaiCha . 

### 2.3 ZhengQueZuoFa 

- LuJing by project RuKou or share.project_path TongYiBaoZheng ; if BiXu in this module SuanLuJing , WenDangZhuMing " JiaDing in controller/d4func Xia ". 
- and map_name_recognizer, region_detector Diao use ShunXu and XieRu when Ji in WenDang in XieMing ; get FanHui "Unknown" when Diao use FangYingShi for " ShangWeiShiBie " and Fei " no Tu ". 
- DuoXianCheng / Yi step XieRu detected_regions when , YueDingDanXie or JiaSuo , BiMian and map_name_utils set/clear JingTai . 
- YiChang at least DaRiZhi , BiMianLuo except JingMoShiBai . 

---

## San , scripts/prepare_detection_training.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: YOLO JianCeXunLianShuJuZhiBei ; Cong yes/no sub directory JiaZaiXiaoTu , Tie to BeiJingTuShang and ZuoSuiJiBianHuan , ShengCheng images/train, images/val, labels, data.yaml, metadata.json. 
- ** YueDing **: class_id 0=no, 1=yes, and data.yaml `names: ['no', 'yes']` ShunXuYiZhi ; bbox for YOLO GuiYiHuaGeShi (center_x, center_y, width, height) ; namespace use at WenJianMing and metadata. 
- ** LuJing **: `current_dir = os.path.dirname(script)`, `parent_dir = os.path.dirname(current_dir)`, `sys.path.insert(0, parent_dir)` JiaDingJiao this in `scripts/` XiaYun line . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Luo except TunCuo **: `_paste_image_on_background` within `try: result[y:y+sm_h, x:x+sm_w] = small_image` Hou `except: pass`; if slice ChiCunYueJie or LeiXingCuoWuHuiJingMoShiBai , but bbox RengAnYuan small_image ChiCunFanHui , DaoZhiBiaoZhu and TuXiang within Rong not YiZhi , XunLianChuCuo . 
2. ** Fei ASCII LuJing **: `cv2.imread(str(img_file))` in BuFenHuanJingXia to Han in Wen etc. Fei ASCII LuJingShiBai , XiaoTu directory if Han in WenHuiLouZai , yes/no ShuLiang for 0 Reng continue PaoHuiChuKongLieBiao or YiChang . 
3. **output_dir Xiang to LuJing **: data.yaml in `path: self.output_dir.absolute()` YiLaiDangQianGongZuo directory ; if Jiao this CongBie GongZuo directory Yun line , path HuiZhiXiangCuoWu position Zhi , XunLian when Zhao not to Tu . 
4. **class ShunXu **: class_id 0=no, 1=yes and data.yaml names ShunXuBiXu and XunLian / reasoning Jiao this YiZhi ; if ZhiGaiYiCeHuiDaoZhiLeiBieFan . 
5. ** BeiJingTuJiaZaiShiBai **: `background = cv2.imread(str(...))` ShiBai when background for None, HouMian `background.shape` HuiBaoCuo ; DangQian have `if background is None: continue`, but if LouGai or FuZhi to BieChuKeNengQueShi . 
6. **data.yaml/metadata XieRu when Ji **: in XunHuanWaiXieRu , if XunHuan in YiChangTuiChu , KeNengShengCheng not WanZhengShuJuJi but Yi have yaml/metadata, YiWuDao ; Ke in QuanBuChengGongHouZaiXie , or ZhuMing " ShengCheng in Duan when yaml KeNeng not WanZheng ". 

### 3.3 ZhengQueZuoFa 

- Luo except Gai for `except Exception as e`, DaRiZhi and TiaoGuoGaiTu or FanHuiCuoWu , BiMianZhanTieShiBaiRengXieBiaoZhu . 
- XiaoTuLuJingHanFei ASCII when use `np.fromfile(..., dtype=np.uint8)` + `cv2.imdecode` or TongYi UTF-8 LuJing ; JiaZaiHouJianCha yes_images/no_images FeiKongZaiShengCheng . 
- output_dir JianYi use Jue to LuJing or by Diao use FangChuanRu ; in data.yaml in Xie path when ZhuMing " Xiang to at this yaml Suo in directory " or " Jue to LuJing " and in WenDang note . 
- BaoChi class_id and names ShunXuYiZhi , and in Jiao this ZhuShi or WenDang in XieMing 0=no, 1=yes; XunLian / reasoning DaiMaYin use TongYiYueDing . 
- BeiJingTuJiaZaiShiBai when TiaoGuo and JiShu , BiMian None JinRuHouXuLuoJi . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as Ba bn_flow_B7 DangQuanWeiShuJu , KuaiZhao structure and PanDuanLuoJi not YiZhi , map_name_utils LuJing or and FaWeiYueDing , prepare_detection_training Luo except or class ShunXu not YiZhi ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for ShiXian and YueDing not YiZhiSuoZhi . this note YiXieRu `cursor_AI_ apology directory `, and in `Cursor_ ZhuanShu apology document .md` in ZengJia to this Wen Yin use , Bian at HouXuXiuGaiQianXianChaCiChuYueDing . 
