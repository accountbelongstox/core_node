# technical note : scan_rosbot_running, neutral_color_matcher, ocr_helper

** Mu **: note this SanChuJiao this / module ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `scripts/scan_rosbot_running.py`
- `scripts/neutral_color_matcher.py`
- `d3utils/ocr_helper.py`

---

## Yi , scripts/scan_rosbot_running.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** TiaoShiJiao this **, SaoMiaoDangQian Windows XiaZheng in Yun line ROSBOT ( Zhu exe + Tong directory Qi it exe) . use **d3utils.rosbot_manager**: get_rosbot_manager(), get_ros_directory(), find_other_exe_files(), get_running_rosbot_processes(), get_rosbot_window(). WenDangYaoQiu ** Cong pyapps/d3-check Yun line **: `python scripts/scan_rosbot_running.py`. 
- ** LuJing **: project_root = dirname(dirname(abspath(__file__))), repo_root = project_root ZaiShangYiJi ; sys.path ChaRu project_root and repo_root. if ros_directory Wei config , HuiXianChangShi providor_index.initialize_config(), ZaiSao ; WeiSheZhi when output "(not set)" and KongLieBiao . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Yun line directory CuoWu **: if in repo Gen or Qi it directory Yun line `python pyapps/d3-check/scripts/scan_rosbot_running.py` QieWeiBa d3-check JiaRu path, Hui import ShiBai ; BiXuCong pyapps/d3-check for cwd Yun line , or BaoZheng sys.path YiHan d3-check and core_node. 
2. **CONFIG WeiJiaZai **: if CONFIG.ros_settings.ros_directory for KongQie initialize_config() ShiBai or not executed , get_ros_directory() FanHuiKong , find_other_exe_files/get_running_rosbot_processes for Kong , Yi by WuRen for " no have ROSBOT"; ShiJiKeNeng is config Wei then Xu . 
3. ** and _obsolete_rosbot_manager HunXiao **: this Jiao this use is **d3utils.rosbot_manager** ( DangQianYueDing ) , not utils._obsolete_rosbot_manager; if Gai for Cong obsolete QuJinChengLieBiao , Hui and rosbot_status_provider, flow use not YiZhi . 
4. **get_rosbot_window() and get_running_rosbot_processes()**: QianZheFanHui " DangQianXuan in ROSBOT ChuangKou " ( Tong directory exe DanYiChuangKou ) ; HouZheFanHuiSuo have Tong directory XiaYun line in JinChengLieBiao ; if QiWang " Yi ChuangKou to YingYi JinCheng " Xu understand same-dir exe YueDing ( Jian ROSBOT_LOOKUP_FLOW) . 

### 1.3 ZhengQueZuoFa 

- ShiZhongCong pyapps/d3-check Yun line Jiao this ; QueBao CONFIG YiJiaZaiQie ros_directory Yi config HouZaiJieDu output ; not Gai for YiLai _obsolete_rosbot_manager; understand get_rosbot_window and get_running_rosbot_processes ChaYi and same-dir exe YuYi . 

---

## Er , scripts/neutral_color_matcher.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** in XingYanSePiPei **: JiangMuBanTu etc. BiSuoFang to Kuan 4px, use k-means TiQuZuiDuo 5 in XingSe (BGR) , in DaTuShang use YuanTuChiCun HuaDongChuangKouPiPei , ZhiFanHui ** Yi ** ZuiJia position Zhi ; ZhiChi SeCha (DEFAULT_TOLERANCE=15) . ZhuYaoJieKou : find_template_in_image(haystack_bgr, template_path, tolerance, min_ratio), build_template_descriptor, find_single_match. MuBanLuJingYiLai **providor.constants.common.TEMPLATE_DIR**; main() in use primal_native.png, ancient_native.png, output to TEMPLATE_DIR/neutral_color_reverse. 
- ** YueDing **: ShuRuTuXiang for **BGR** (cv2.imread) ; YanSeYuanZu for (B,G,R); min_ratio for ChuangKou within PiPeiXiangSuZhanBiXiaXian ; ZhiBaoLiu FenZuiGao YiChu (x,y). 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Yun line directory or LuJing **: Jiao this LuJingJi at __file__ (_d3_check_root, _core_node_root) ; if Jiao this YiDong or TEMPLATE_DIR ZhiXiangCuoWu , primal_native.png/ancient_native.png Zhao not to , main() Hui skip; find_template_in_image if ChuanRuCuoWu template_path FanHui None. 
2. **BGR and RGB Hun use **: if Diao use FangChuanRu is RGB Tu or PIL WeiZhuan BGR, YanSeFanWei and cv2.inRange HuiCuo , PiPeiShiBai or WuPiPei . 
3. **tolerance / min_ratio and Diao use Fang not YiZhi **: if ZhuLiuCheng ( such as debug_bag_hover) use not Tong tolerance or min_ratio Diao use find_template_in_image, or MoRen 15/0.5 and Qi it MuBanPiPeiLuoJi not YiZhi , JieGuoHui and YuQi not Fu . 
4. ** DanDianFanHui **: find_single_match ZhiFanHuiYi (x,y); if YeWuXuYao " Suo have PiPei " or " DuoMuBan ", Xu in WaiCengXunHuan or Gai use Qi it PiPeiLuoJi , WuJiaDingKeFanHuiLieBiao . 
5. ** MuBanWenJianMing **: main() and WenDang hardcode primal_native, ancient_native; if MuBanGaiMing or ZengJiaXinMuBanWeiTong step main(), KeShiHua output not WanZheng ; as Ku use when to ChuanRu path for Zhun . 

### 2.3 ZhengQueZuoFa 

- Diao use find_template_in_image when BaoZheng haystack for BGR, template_path Cun in Qie for primal_native/ancient_native or YueDingMuBan ; tolerance/min_ratio and use ChangJingYiZhi ; XuYaoDuoJieGuo when in WaiBuXunHuan or LingXieLuoJi ; Jiao this Cong d3-check GenYun line , TEMPLATE_DIR ZhengQue when main() CaiNengWanZhengPaoTong . 

---

## San , d3utils/ocr_helper.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: **OCR FuZhu **: GongXiang " Tu in is FouHanMouGuanJianCi " and " GuanJianCiKuang " LuoJi . YiLai **pycore.pyfoundations.third_party.get_third_package_CnOCREngine()** ( DanLi ) . JieKou : **ocr_get_result(image_input)** (path or PIL Image, FanHui {text, raw_result} or None) , **ocr_has_any_keywords(image_path, keywords)** ( FanHui bool) , **ocr_find_keyword_boxes(image_path, keywords)** ( FanHui [{keyword, text, bbox}]) ; bbox for (min_x, min_y, max_x, max_y). FuZhu : _boxes_from_raw_result(raw_result, keywords), _position_to_bbox(position), bbox_center, bbox_first_char_center, bbox_left_center ( use at TongYi item KuanDianJi etc. ) . 
- ** YueDing **: raw_result for list of {text, position}; position Ke for list of [x,y] or np.ndarray (4,2); QueShi position when bbox for None Qie _boxes_from_raw_result HuiTiaoGuoGai item . GuanJianCiPiPei for ** sub Chuan ** (kw in text) . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **ocr_get_result and ocr_has_any_keywords RuCan not Tong **: ocr_get_result ZhiChi path or **PIL Image** ( BiMianCiPan I/O) ; ocr_has_any_keywords, ocr_find_keyword_boxes DangQianZhiJieShou path. if to within CunTuDiao use ocr_has_any_keywords HuiChuan path ShiBai ; YingXian use ocr_get_result(image) Zai _boxes_from_raw_result(raw_result, keywords). 
2. **engine for None**: if CnOCR WeiAnZhuang or get_third_package_CnOCREngine() FanHui None, Suo have JieKouFanHui None/False/[]; Diao use Fang if WeiPanKongHuiBaoCuo or WuPan for " no GuanJianCi ". 
3. **raw_result structure BianHua **: if CnOCR ShengJiHou raw_result GeShiBianHua ( such as position JianMing or XingZhuang ) , _position_to_bbox or _boxes_from_raw_result KeNengBaoCuo or LouKuang ; Xu and No. SanFangYinQingYueDingYiZhi . 
4. ** GuanJianCi for sub Chuan **: ocr_has_any_keywords use `kw in text`; if GuanJianCiGuoDuan or and Qi it Ci sub ChuanChongHe , HuiWuPan ; if XuYaoZhengCi or ZhengZe , Xu in Diao use Fang or this module KuoZhan . 
5. **bbox ZuoBiaoXi **: bbox for TuXiangZuoBiao ; bbox_left_center, bbox_first_char_center use at DianJi when XuJiaShangChuangKou / CaiJianPianYi , Diao use Fang if ZhiJieDangPingMuZuoBiaoHuiDianCuo . 
6. ** ChongFu OCR**: ocr_find_keyword_boxes within BuDiao ocr_get_result; if Yi have YiCi ocr_get_result JieGuo , Ying use _boxes_from_raw_result Fu use , BiMianTongYiZhangTu OCR LiangCi . 

### 3.3 ZhengQueZuoFa 

- within CunTu use ocr_get_result(PIL Image) + _boxes_from_raw_result; WenJianLuJingKe use ocr_has_any_keywords/ocr_find_keyword_boxes; use QianJianCha engine Ke use Xing ; GuanJianCi and raw_result/position YueDing and CnOCR YiZhi ; bbox ZhuanDianJiZuoBiao when JiaShangChuangKou / QuYuPianYi ; BiMian to TongYiTuChongFuDiao use OCR. 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as scan_rosbot_running Yun line directory or CONFIG WeiJiaZaiWuPan , neutral_color_matcher BGR/ DanDianFanHui /tolerance Hun use , ocr_helper path and PIL RuCanHun use or raw_result structure JiaSheCuoWu ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
